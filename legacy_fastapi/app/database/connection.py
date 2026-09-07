"""
Database connection and session management.
Defaults to SQLite for hackathon prototyping, with clean path to PostgreSQL/PostGIS.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.app.config import settings

# Ensure sqlite data directory exists if relative path
if "sqlite" in settings.DATABASE_URL:
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    parent_dir = Path(db_path).parent
    parent_dir.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Enable WAL mode and foreign keys for SQLite
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables in the database."""
    from sqlalchemy import text
    from backend.app.models import (
        ThermalEvent,
        FacilityContext,
        EventFeatures,
        PersistenceGroup,
    )
    Base.metadata.create_all(bind=engine)

    # Safe column migration for SQLite
    if "sqlite" in settings.DATABASE_URL:
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE thermal_events ADD COLUMN status VARCHAR(32) DEFAULT 'Active'"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE thermal_events ADD COLUMN resolved_at DATETIME"))
                conn.commit()
            except Exception:
                pass
