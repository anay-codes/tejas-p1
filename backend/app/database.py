from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_sqlite_migrations():
    """Applies non-destructive schema migrations for existing SQLite databases."""
    if not is_sqlite:
        return
    import sqlite3
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check and add columns to incidents table if missing
        cursor.execute("PRAGMA table_info(incidents)")
        inc_cols = [row[1] for row in cursor.fetchall()]
        if inc_cols:
            if "resolution_notes" not in inc_cols:
                cursor.execute("ALTER TABLE incidents ADD COLUMN resolution_notes TEXT")
            if "anpr_data" not in inc_cols:
                cursor.execute("ALTER TABLE incidents ADD COLUMN anpr_data JSON DEFAULT '{}'")
            if "affected_track_id" not in inc_cols:
                cursor.execute("ALTER TABLE incidents ADD COLUMN affected_track_id VARCHAR(50)")
            if "updated_at" not in inc_cols:
                cursor.execute("ALTER TABLE incidents ADD COLUMN updated_at DATETIME")

        # Check and add columns to audit_logs table if missing
        cursor.execute("PRAGMA table_info(audit_logs)")
        audit_cols = [row[1] for row in cursor.fetchall()]
        if audit_cols:
            if "details" not in audit_cols:
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN details JSON DEFAULT '{}'")
            if "created_at" not in audit_cols:
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN created_at DATETIME")

        # Check and add columns to events table if missing
        cursor.execute("PRAGMA table_info(events)")
        evt_cols = [row[1] for row in cursor.fetchall()]
        if evt_cols:
            if "incident_id" not in evt_cols:
                cursor.execute("ALTER TABLE events ADD COLUMN incident_id VARCHAR(100)")

        conn.commit()

        # Phase 2 migrations
        cursor.execute("PRAGMA table_info(alerts)")
        alert_cols = [row[1] for row in cursor.fetchall()]
        if alert_cols and "alert_level" not in alert_cols:
            cursor.execute("ALTER TABLE alerts ADD COLUMN alert_level VARCHAR(20) DEFAULT 'INFO'")

        cursor.execute("PRAGMA table_info(users)")
        user_cols = [row[1] for row in cursor.fetchall()]
        if not user_cols:
            pass  # Will be created by create_all

        conn.commit()
        conn.close()
    except Exception as e:
        # Ignore if tables not yet created (create_all will create them)
        pass

