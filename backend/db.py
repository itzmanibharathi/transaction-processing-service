"""SQLite configuration and schema for the transaction service."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "transaction.db"


def get_connection(timeout: float = 10.0) -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=timeout)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    # WAL is enabled during initialization. FULL prioritizes durability.
    conn.execute("PRAGMA synchronous = FULL")
    return conn


def initialize_database() -> None:
    conn = get_connection()
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                amount NUMERIC NOT NULL CHECK(amount > 0),
                currency TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metadata TEXT,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','processing','completed','failed')),
                claimed_at TEXT,
                claim_token TEXT,
                next_retry_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                error_message TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions_attempts (
                attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL,
                attempt_number INTEGER NOT NULL,
                operation TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                outcome TEXT NOT NULL,
                http_status INTEGER,
                error_message TEXT,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id)
            )
        """)
        # Migrate existing databases without dropping any data.
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(transactions)")}
        migrations = {
            "claimed_at": "ALTER TABLE transactions ADD COLUMN claimed_at TEXT",
            "claim_token": "ALTER TABLE transactions ADD COLUMN claim_token TEXT",
            "next_retry_at": "ALTER TABLE transactions ADD COLUMN next_retry_at TEXT",
            "created_at": "ALTER TABLE transactions ADD COLUMN created_at TEXT",
            "completed_at": "ALTER TABLE transactions ADD COLUMN completed_at TEXT",
            "error_message": "ALTER TABLE transactions ADD COLUMN error_message TEXT",
        }
        for name, sql in migrations.items():
            if name not in columns:
                conn.execute(sql)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_status_retry ON transactions(status, next_retry_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_attempts_transaction ON transactions_attempts(transaction_id, attempt_number)")
        conn.commit()
        check = conn.execute("PRAGMA quick_check").fetchone()[0]
        if check != "ok":
            raise RuntimeError(f"Database integrity check failed: {check}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    initialize_database()
    print(f"Database ready: {DB_PATH}")
