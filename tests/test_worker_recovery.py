"""Local recovery-state test; no remote service calls are made."""
from datetime import datetime, timedelta, timezone

import db
import transaction_worker as worker


def test_stale_processing_claim_is_recovered(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "recovery_test.db")
    db.initialize_database()

    stale_time = (datetime.now(timezone.utc) - timedelta(seconds=35)).isoformat()
    conn = db.get_connection()
    try:
        conn.execute(
            """INSERT INTO transactions
               (id, amount, currency, description, timestamp, status, claimed_at, claim_token)
               VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)""",
            (
                "recovery-test-transaction",
                10,
                "USD",
                "recovery test",
                datetime.now(timezone.utc).isoformat(),
                stale_time,
                "old-claim-token",
            ),
        )
        conn.commit()
    finally:
        conn.close()

    worker.recover_stale_claims()

    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT status, claimed_at, claim_token FROM transactions WHERE id=?",
            ("recovery-test-transaction",),
        ).fetchone()
        assert row["status"] == "pending"
        assert row["claimed_at"] is None
        assert row["claim_token"] is None
    finally:
        conn.close()
