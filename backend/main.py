import csv
import io
import json
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field, validator

from db import DB_PATH, get_connection, initialize_database

VALID_STATUSES = {"pending", "processing", "completed", "failed"}
MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_CSV_ROWS = 1000
MAX_REPORT_ROWS = 10000

TRANSACTION_FIELDS = [
    "id", "amount", "currency", "description", "timestamp",
    "metadata", "status", "created_at", "completed_at",
    "error_message",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Transaction Processing Service",
    description="Durable transaction intake, processing, and audit reporting",
    version="1.4.0",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "OPENFABRIC_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


class Transaction(BaseModel):
    id: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0, allow_inf_nan=False)
    currency: str = Field(..., min_length=3, max_length=3)
    description: str = Field(..., min_length=1, max_length=500)
    timestamp: str = Field(..., min_length=1, max_length=50)
    metadata: dict | None = None

    @validator("id", "currency", "description", "timestamp")
    def strip_values(cls, value):
        return value.strip()

    @validator("currency")
    def validate_currency(cls, value):
        if not re.fullmatch(r"[A-Za-z]{3}", value):
            raise ValueError("currency must be exactly three letters")
        return value.upper()

    @validator("timestamp")
    def validate_timestamp(cls, value):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(
                "timestamp must be a valid ISO-8601 datetime with timezone"
            ) from exc

        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError(
                "timestamp must include a timezone, e.g. Z or +05:30"
            )
        return value

    class Config:
        anystr_strip_whitespace = True


def metadata_json(value):
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"))
        if value is not None else None
    )


def payload_matches(existing, transaction):
    old_metadata = (
        json.loads(existing["metadata"])
        if existing["metadata"] is not None else None
    )

    return (
        float(existing["amount"]) == float(transaction.amount)
        and existing["currency"].upper() == transaction.currency.upper()
        and existing["description"] == transaction.description
        and existing["timestamp"] == transaction.timestamp
        and old_metadata == transaction.metadata
    )


def serialize_transaction(row):
    result = dict(row)

    if result.get("metadata") is not None:
        result["metadata"] = json.loads(result["metadata"])

    result["transactionId"] = result.get("id")
    submitted_at = result.get("created_at") or result.get("timestamp")

    if submitted_at and isinstance(submitted_at, str):
        try:
            parsed = datetime.fromisoformat(
                submitted_at.replace("Z", "+00:00")
            )
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            submitted_at = parsed.isoformat().replace("+00:00", "Z")
        except ValueError:
            pass

    result["submittedAt"] = submitted_at
    result["completedAt"] = result.get("completed_at")
    result["error"] = result.get("error_message")
    return result


def db_unavailable(exc):
    return HTTPException(
        status_code=503,
        detail="Database temporarily unavailable; retry the request",
    )


def insert_transaction(conn, transaction):
    """Insert a new transaction. Caller manages the database transaction."""
    submitted_at = datetime.now(timezone.utc).isoformat()

    conn.execute(
        """
        INSERT INTO transactions
            (id, amount, currency, description, timestamp,
             metadata, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        """,
        (
            transaction.id,
            transaction.amount,
            transaction.currency.upper(),
            transaction.description,
            transaction.timestamp,
            metadata_json(transaction.metadata),
            submitted_at,
        ),
    )
    return submitted_at


def parse_report_date(value, field_name):
    if value is None:
        return None

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a valid ISO-8601 date or datetime",
        ) from exc

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must include a timezone",
        )

    return parsed.astimezone(timezone.utc).isoformat()


def get_report_rows(conn, status, start_date, end_date, date_field, transaction_id):
    """Build a parameterized report query."""
    conditions = []
    params = []

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid transaction status")
        conditions.append("status = ?")
        params.append(status)

    if transaction_id:
        conditions.append("id = ?")
        params.append(transaction_id)

    date_column = {
        "submitted": "created_at",
        "transaction": "timestamp",
    }[date_field]

    if start_date:
        conditions.append(f"{date_column} >= ?")
        params.append(start_date)

    if end_date:
        conditions.append(f"{date_column} <= ?")
        params.append(end_date)

    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""

    total = conn.execute(
        f"SELECT COUNT(*) AS total FROM transactions{where_sql}",
        params,
    ).fetchone()["total"]

    rows = conn.execute(
        f"""
        SELECT * FROM transactions
        {where_sql}
        ORDER BY rowid DESC
        LIMIT ?
        """,
        params + [MAX_REPORT_ROWS],
    ).fetchall()

    return total, [serialize_transaction(row) for row in rows]


def csv_safe(value):
    """Reduce spreadsheet formula injection risk in exported CSV text."""
    if value is None:
        return ""

    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)

    value = str(value)

    if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value

    return value


def create_csv(rows, columns):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(columns)

    for row in rows:
        writer.writerow([csv_safe(row.get(column)) for column in columns])

    return output.getvalue()


def download_response(content, media_type, filename):
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.post("/api/transactions", status_code=202)
def create_transaction(transaction: Transaction):
    started = time.perf_counter()
    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction.id,),
        ).fetchone()

        if existing:
            if not payload_matches(existing, transaction):
                raise HTTPException(
                    status_code=409,
                    detail="Transaction ID already used with different data",
                )

            result = {
                "transactionId": transaction.id,
                "transaction_id": transaction.id,
                "status": existing["status"],
                "submittedAt": existing["created_at"],
                "completedAt": existing["completed_at"],
                "error": existing["error_message"],
                "message": "Transaction already exists",
            }
            conn.commit()
            return result

        submitted_at = insert_transaction(conn, transaction)
        conn.commit()

        elapsed_ms = (time.perf_counter() - started) * 1000
        print(
            f"[PERF] accepted id={transaction.id} "
            f"elapsed_ms={elapsed_ms:.2f}"
        )

        return {
            "transactionId": transaction.id,
            "transaction_id": transaction.id,
            "status": "pending",
            "submittedAt": submitted_at,
            "completedAt": None,
            "error": None,
            "message": "Transaction durably accepted",
        }

    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.Error as exc:
        conn.rollback()
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.post("/api/transactions/import")
async def import_transactions(file: UploadFile = File(...)):
    """Import CSV transactions. Valid rows are committed as pending."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    raw = await file.read(MAX_CSV_BYTES + 1)
    await file.close()

    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 5 MB limit")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="CSV must use UTF-8 encoding",
        ) from exc

    reader = csv.DictReader(io.StringIO(text))

    required = {"id", "amount", "currency", "description", "timestamp"}
    headers = set(reader.fieldnames or [])

    if not required.issubset(headers):
        missing = sorted(required - headers)
        raise HTTPException(
            status_code=400,
            detail={"message": "CSV is missing required columns", "missing": missing},
        )

    conn = get_connection()
    result = {
        "filename": file.filename,
        "rows_read": 0,
        "accepted": 0,
        "duplicates": 0,
        "conflicts": 0,
        "rejected": 0,
        "errors": [],
    }

    try:
        for row_number, row in enumerate(reader, start=2):
            result["rows_read"] += 1

            if result["rows_read"] > MAX_CSV_ROWS:
                raise HTTPException(
                    status_code=413,
                    detail=f"CSV exceeds the {MAX_CSV_ROWS}-row limit",
                )

            try:
                metadata_value = row.get("metadata")
                metadata = None

                if metadata_value and metadata_value.strip():
                    metadata = json.loads(metadata_value)
                    if not isinstance(metadata, dict):
                        raise ValueError("metadata must contain a JSON object")

                transaction = Transaction(
                    id=row.get("id", ""),
                    amount=float(row.get("amount", "")),
                    currency=row.get("currency", ""),
                    description=row.get("description", ""),
                    timestamp=row.get("timestamp", ""),
                    metadata=metadata,
                )

                conn.execute("BEGIN IMMEDIATE")
                existing = conn.execute(
                    "SELECT * FROM transactions WHERE id = ?",
                    (transaction.id,),
                ).fetchone()

                if existing:
                    conn.rollback()

                    if payload_matches(existing, transaction):
                        result["duplicates"] += 1
                    else:
                        result["conflicts"] += 1
                        result["errors"].append({
                            "row": row_number,
                            "id": transaction.id,
                            "error": "Transaction ID already exists with different data",
                        })
                    continue

                insert_transaction(conn, transaction)
                conn.commit()
                result["accepted"] += 1

            except HTTPException:
                conn.rollback()
                raise
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                conn.rollback()
                result["rejected"] += 1
                result["errors"].append({
                    "row": row_number,
                    "id": row.get("id", ""),
                    "error": str(exc),
                })
            except sqlite3.Error as exc:
                conn.rollback()
                raise db_unavailable(exc) from exc

        return result

    except HTTPException:
        raise
    finally:
        conn.close()


@app.get("/api/transactions")
def list_transactions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
):
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid transaction status")

    conn = get_connection()
    try:
        if status:
            total = conn.execute(
                "SELECT COUNT(*) AS total FROM transactions WHERE status = ?",
                (status,),
            ).fetchone()["total"]
            rows = conn.execute(
                """
                SELECT * FROM transactions
                WHERE status = ?
                ORDER BY rowid DESC LIMIT ? OFFSET ?
                """,
                (status, limit, offset),
            ).fetchall()
        else:
            total = conn.execute(
                "SELECT COUNT(*) AS total FROM transactions"
            ).fetchone()["total"]
            rows = conn.execute(
                "SELECT * FROM transactions ORDER BY rowid DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "status_filter": status,
            "transactions": [serialize_transaction(row) for row in rows],
        }
    except (sqlite3.Error, json.JSONDecodeError) as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/transactions/{transaction_id}/attempts")
def get_transaction_attempts(transaction_id: str):
    conn = get_connection()
    try:
        exists = conn.execute(
            "SELECT 1 FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

        if not exists:
            raise HTTPException(status_code=404, detail="Transaction not found")

        rows = conn.execute(
            """
            SELECT attempt_id, transaction_id, attempt_number, operation,
                   started_at, finished_at, outcome, http_status, error_message
            FROM transactions_attempts
            WHERE transaction_id = ?
            ORDER BY attempt_number, attempt_id
            """,
            (transaction_id,),
        ).fetchall()

        return {
            "transaction_id": transaction_id,
            "total_attempts": len(rows),
            "attempts": [dict(row) for row in rows],
        }
    except HTTPException:
        raise
    except sqlite3.Error as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/transactions/{transaction_id}")
def get_transaction(transaction_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Transaction not found")

        return serialize_transaction(row)
    except HTTPException:
        raise
    except (sqlite3.Error, json.JSONDecodeError) as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/reports/summary")
def report_summary():
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT status, COUNT(*) AS total
            FROM transactions
            GROUP BY status
            """
        ).fetchall()

        counts = {status: 0 for status in VALID_STATUSES}
        for row in rows:
            counts[row["status"]] = row["total"]

        total = sum(counts.values())

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_transactions": total,
            "by_status": counts,
            "completion_rate": round(
                counts["completed"] / total, 4
            ) if total else 0,
        }
    except sqlite3.Error as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/reports/transactions")
def transaction_report(
    format: str = Query("csv", regex="^(csv|json)$"),
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    date_field: str = Query("submitted", regex="^(submitted|transaction)$"),
    transaction_id: str | None = None,
):
    start = parse_report_date(start_date, "start_date")
    end = parse_report_date(end_date, "end_date")

    if start and end and start > end:
        raise HTTPException(
            status_code=400,
            detail="start_date must not be later than end_date",
        )

    conn = get_connection()
    try:
        total, rows = get_report_rows(
            conn, status, start, end, date_field, transaction_id
        )

        if total > MAX_REPORT_ROWS:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Report contains {total} records. "
                    f"Apply filters to limit it to {MAX_REPORT_ROWS} records."
                ),
            )

        columns = [
            "id", "amount", "currency", "description", "timestamp",
            "status", "submittedAt", "completedAt", "error", "metadata",
        ]

        if format == "json":
            content = json.dumps(
                {
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "filters": {
                        "status": status,
                        "start_date": start_date,
                        "end_date": end_date,
                        "date_field": date_field,
                        "transaction_id": transaction_id,
                    },
                    "total": total,
                    "transactions": rows,
                },
                indent=2,
                ensure_ascii=False,
            )
            return download_response(
                content,
                "application/json; charset=utf-8",
                "transaction_audit.json",
            )

        content = create_csv(rows, columns)
        return download_response(
            content,
            "text/csv; charset=utf-8",
            "transaction_audit.csv",
        )

    except HTTPException:
        raise
    except (sqlite3.Error, json.JSONDecodeError) as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/reports/attempts")
def attempts_report(
    format: str = Query("csv", regex="^(csv|json)$"),
    transaction_id: str | None = None,
):
    conn = get_connection()
    try:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='transactions_attempts'"
        ).fetchone()

        if not exists:
            raise HTTPException(
                status_code=503,
                detail="Processing-attempt table is not available",
            )

        if transaction_id:
            rows = conn.execute(
                """
                SELECT attempt_id, transaction_id, attempt_number, operation,
                       started_at, finished_at, outcome, http_status, error_message
                FROM transactions_attempts
                WHERE transaction_id = ?
                ORDER BY attempt_number, attempt_id
                LIMIT ?
                """,
                (transaction_id, MAX_REPORT_ROWS),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT attempt_id, transaction_id, attempt_number, operation,
                       started_at, finished_at, outcome, http_status, error_message
                FROM transactions_attempts
                ORDER BY attempt_id DESC
                LIMIT ?
                """,
                (MAX_REPORT_ROWS,),
            ).fetchall()

        records = [dict(row) for row in rows]

        if format == "json":
            return download_response(
                json.dumps(
                    {
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                        "total": len(records),
                        "attempts": records,
                    },
                    indent=2,
                    ensure_ascii=False,
                ),
                "application/json; charset=utf-8",
                "transaction_attempts.json",
            )

        columns = [
            "attempt_id", "transaction_id", "attempt_number", "operation",
            "started_at", "finished_at", "outcome", "http_status", "error_message",
        ]

        return download_response(
            create_csv(records, columns),
            "text/csv; charset=utf-8",
            "transaction_attempts.csv",
        )

    except HTTPException:
        raise
    except sqlite3.Error as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/health")
@app.get("/api/health")
def health_check():
    conn = get_connection()
    try:
        integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
        counts = {
            row["status"]: row["total"]
            for row in conn.execute(
                "SELECT status, COUNT(*) AS total FROM transactions GROUP BY status"
            )
        }

        attempts = conn.execute(
            """
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN outcome='success' THEN 1 ELSE 0 END) AS successful,
                   SUM(CASE WHEN outcome='failed' THEN 1 ELSE 0 END) AS failed
            FROM transactions_attempts
            """
        ).fetchone()

        if integrity != "ok":
            raise HTTPException(
                status_code=503,
                detail="Database integrity check failed",
            )

        attempt_total = attempts["total"] or 0
        failed_total = attempts["failed"] or 0

        return {
            "status": "healthy",
            "database": {"path": str(DB_PATH), "integrity": integrity},
            "transactions": {
                "total": sum(counts.values()),
                "by_status": {
                    status: counts.get(status, 0)
                    for status in sorted(VALID_STATUSES)
                },
                "queue_depth": counts.get("pending", 0),
                "processing": counts.get("processing", 0),
            },
            "attempts": {
                "total": attempt_total,
                "successful": attempts["successful"] or 0,
                "failed": failed_total,
                "error_rate": round(
                    failed_total / attempt_total, 4
                ) if attempt_total else 0.0,
            },
        }
    except HTTPException:
        raise
    except sqlite3.Error as exc:
        raise db_unavailable(exc) from exc
    finally:
        conn.close()


@app.get("/api/ready")
def readiness():
    return {"ready": True, "queue": "sqlite-polling", "database": str(DB_PATH)}


@app.get("/api/metrics")
def metrics():
    snapshot = health_check()
    return {
        "transactions": snapshot["transactions"],
        "attempts": snapshot["attempts"],
    }
