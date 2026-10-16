"""SQLite polling worker with bounded concurrency, retry scheduling, and lease recovery."""
import json
import logging
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone, timedelta

from db import get_connection, initialize_database

MOCK_SERVICE_URL = "https://mock-posting-service-latest.onrender.com"
MAX_RETRIES = 3
MAX_WORKERS = 8
POLL_INTERVAL = 0.5
REQUEST_TIMEOUT = 12
CLAIM_TIMEOUT_SECONDS = 20
RECOVERY_INTERVAL_SECONDS = 3
RETRY_DELAY_SECONDS = 2
HEARTBEAT_INTERVAL_SECONDS = 5
MAX_RETRY_DELAY_SECONDS = 60

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def future_iso(seconds):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def log_attempt(conn, transaction_id, number, operation, outcome, started, status=None, error=None):
    conn.execute("""
        INSERT INTO transactions_attempts
        (transaction_id, attempt_number, operation, started_at, finished_at, outcome, http_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (transaction_id, number, operation, started, now_iso(), outcome, status, error))


class RemoteServiceError(Exception):
    def __init__(self, message, http_status=None):
        super().__init__(message)
        self.http_status = http_status


def request_json(method, path, payload=None):
    url = f"{MOCK_SERVICE_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            status = response.status
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RemoteServiceError(f"Network error: {exc}") from exc
    try:
        decoded = json.loads(body) if body else {}
    except json.JSONDecodeError:
        decoded = {"response": body}
    return status, decoded


def remote_exists(transaction_id):
    safe_id = urllib.parse.quote(str(transaction_id), safe="")
    status, body = request_json("GET", f"/transactions/{safe_id}")
    if status == 200:
        return True
    if status == 404:
        return False
    raise RemoteServiceError(f"Remote GET returned HTTP {status}: {body}", status)


def post_transaction(transaction):
    raw = transaction.get("metadata")
    metadata = json.loads(raw) if isinstance(raw, str) and raw else raw
    payload = {key: transaction[key] for key in ("id", "amount", "currency", "description", "timestamp")}
    payload["metadata"] = metadata
    status, body = request_json("POST", "/transactions", payload)
    if not 200 <= status < 300:
        raise RemoteServiceError(f"Remote POST returned HTTP {status}: {body}", status)
    return status


def retryable(error):
    status = error.http_status
    return status is None or status in (408, 429) or 500 <= status <= 599


def ensure_columns():
    # Shared initializer also applies safe, non-destructive migrations.
    initialize_database()


def recover_stale_claims():
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=CLAIM_TIMEOUT_SECONDS)).isoformat()
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute("""
            UPDATE transactions
            SET status='pending', claimed_at=NULL, claim_token=NULL, next_retry_at=NULL
            WHERE status='processing' AND (claimed_at IS NULL OR claimed_at < ?)
        """, (cutoff,))
        conn.commit()
        if cur.rowcount:
            logger.warning("Recovered %s stale transaction claim(s)", cur.rowcount)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def claim_pending(limit):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        rows = conn.execute("""
            SELECT * FROM transactions
            WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
            ORDER BY rowid LIMIT ?
        """, (now_iso(), limit)).fetchall()
        claimed = []
        for row in rows:
            token = str(uuid.uuid4())
            cur = conn.execute("""
                UPDATE transactions SET status='processing', claimed_at=?, claim_token=?, next_retry_at=NULL
                WHERE id=? AND status='pending'
            """, (now_iso(), token, row["id"]))
            if cur.rowcount == 1:
                item = dict(row)
                item["claim_token"] = token
                claimed.append(item)
        conn.commit()
        return claimed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def renew_claim(tx_id, token):
    conn = get_connection()
    try:
        cur = conn.execute("UPDATE transactions SET claimed_at=? WHERE id=? AND status='processing' AND claim_token=?", (now_iso(), tx_id, token))
        conn.commit()
        return cur.rowcount == 1
    finally:
        conn.close()



def heartbeat(tx_id, token, stop):
    while not stop.wait(HEARTBEAT_INTERVAL_SECONDS):
        try:
            if not renew_claim(tx_id, token):
                conn = get_connection()
                try:
                    row = conn.execute(
                        "SELECT status, claim_token FROM transactions WHERE id=?",
                        (tx_id,)
                    ).fetchone()
                finally:
                    conn.close()

                # A completed or failed transaction no longer needs a lease.
                if row and row["status"] in ("completed", "failed"):
                    return

                logger.warning("Lost claim for %s", tx_id)
                return

        except sqlite3.Error:
            logger.exception("Heartbeat database error for %s", tx_id)



def finish(tx_id, token, status, number, operation, outcome, started, http_status=None, error=None):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute("""
            UPDATE transactions
            SET status=?, claimed_at=NULL, claim_token=NULL, next_retry_at=NULL,
                completed_at=CASE WHEN ? IN ('completed','failed') THEN ? ELSE completed_at END,
                error_message=CASE WHEN ?='failed' THEN ? ELSE NULL END
            WHERE id=? AND status='processing' AND claim_token=?
        """, (status, status, now_iso(), status, error, tx_id, token))
        if cur.rowcount != 1:
            conn.rollback()
            return False
        log_attempt(conn, tx_id, number, operation, outcome, started, http_status, error)
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def record_failure(tx_id, token, number, operation, started, error, release, delay=None):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        if release:
            cur = conn.execute("""
                UPDATE transactions SET status='pending', claimed_at=NULL, claim_token=NULL, next_retry_at=?, error_message=?
                WHERE id=? AND status='processing' AND claim_token=?
            """, (future_iso(delay or 0), str(error), tx_id, token))
        else:
            cur = conn.execute("""
                UPDATE transactions SET claimed_at=?
                WHERE id=? AND status='processing' AND claim_token=?
            """, (now_iso(), tx_id, token))
        if cur.rowcount != 1:
            conn.rollback()
            return False
        log_attempt(conn, tx_id, number, operation, "failed", started, error.http_status, str(error))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def process_transaction(tx):
    tx_id, token = tx["id"], tx["claim_token"]
    logger.info("Processing %s", tx_id)
    conn = get_connection()
    try:
        first = conn.execute("SELECT COALESCE(MAX(attempt_number),0)+1 AS n FROM transactions_attempts WHERE transaction_id=?", (tx_id,)).fetchone()["n"]
    finally:
        conn.close()

    stop = threading.Event()
    thread = threading.Thread(target=heartbeat, args=(tx_id, token, stop), daemon=True)
    thread.start()
    try:
        for offset in range(MAX_RETRIES):
            number = first + offset
            started = now_iso()
            operation = "mock_get"
            try:
                if not renew_claim(tx_id, token):
                    return
                exists = remote_exists(tx_id)
                http_status = 200 if exists else None
                if not exists:
                    operation = "mock_post"
                    try:
                        http_status = post_transaction(tx)
                    except RemoteServiceError as post_error:
                        # Verify after POST errors; never blindly assume POST failed remotely.
                        try:
                            exists_after = remote_exists(tx_id)
                        except RemoteServiceError as verify_error:
                            raise RemoteServiceError(f"POST outcome unknown; verification failed: {verify_error}", verify_error.http_status) from post_error
                        if not exists_after:
                            raise post_error
                        http_status = post_error.http_status
                if finish(tx_id, token, "completed", number, operation, "success", started, http_status):
                    logger.info("Completed %s", tx_id)
                return
            except RemoteServiceError as exc:
                # GET failures or failed verification mean remote state is uncertain: defer and re-check later.
                uncertain = (operation == "mock_get") or ("verification failed" in str(exc).lower()) or ("Network error" in str(exc))
                if uncertain:
                    record_failure(tx_id, token, number, operation, started, exc, True, RETRY_DELAY_SECONDS)
                    return
                if not retryable(exc):
                    finish(tx_id, token, "failed", number, operation, "failed", started, exc.http_status, str(exc))
                    return
                if offset == MAX_RETRIES - 1:
                    delay = min(MAX_RETRY_DELAY_SECONDS, RETRY_DELAY_SECONDS * (2 ** (offset + 1)))
                    record_failure(tx_id, token, number, operation, started, exc, True, delay)
                    return
                if not record_failure(tx_id, token, number, operation, started, exc, False):
                    return
                time.sleep(RETRY_DELAY_SECONDS * (offset + 1))
            except (ValueError, TypeError, KeyError) as exc:
                finish(tx_id, token, "failed", number, operation, "failed", started, None, str(exc))
                return
            except Exception as exc:
                wrapped = RemoteServiceError(str(exc))
                record_failure(tx_id, token, number, operation, started, wrapped, True, RETRY_DELAY_SECONDS)
                logger.exception("Unexpected processing error for %s", tx_id)
                return
    finally:
        stop.set()
        thread.join(timeout=HEARTBEAT_INTERVAL_SECONDS + 1)


def run_worker():
    ensure_columns()
    logger.info("Worker started (workers=%s, lease=%ss)", MAX_WORKERS, CLAIM_TIMEOUT_SECONDS)
    recover_stale_claims()
    last_recovery = time.monotonic()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = set()
        while True:
            try:
                now = time.monotonic()
                if now - last_recovery >= RECOVERY_INTERVAL_SECONDS:
                    recover_stale_claims()
                    last_recovery = now
                done, futures = wait(futures, timeout=0.1, return_when=FIRST_COMPLETED)
                for future in done:
                    try:
                        future.result()
                    except Exception:
                        logger.exception("Worker task crashed")
                capacity = MAX_WORKERS - len(futures)
                if capacity > 0:
                    for tx in claim_pending(capacity):
                        futures.add(pool.submit(process_transaction, tx))
                if not futures:
                    time.sleep(POLL_INTERVAL)
            except sqlite3.Error:
                logger.exception("Worker database error")
                time.sleep(POLL_INTERVAL)
            except Exception:
                logger.exception("Unexpected worker-loop error")
                time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        run_worker()
    except KeyboardInterrupt:
        logger.info("Worker stopped")