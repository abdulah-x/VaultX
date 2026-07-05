from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool, QueuePool
import os
from pathlib import Path

# Create database directory
DB_DIR = Path(__file__).parent.parent.parent / "data"
DB_DIR.mkdir(exist_ok=True)

# Create backup directory
BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

# Database configuration. PostgreSQL is the committed database; DATABASE_URL is
# REQUIRED. We no longer silently fall back to SQLite — a missing URL used to
# create a throwaway .db file that looked like it worked but diverged from prod.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. VaultX requires a PostgreSQL connection string, "
        "e.g. postgresql://user:pass@host:5432/dbname"
    )
TEST_DATABASE_URL = f"sqlite:///{DB_DIR}/test_portfolio.db"

# Detect database type (SQLite retained only for the isolated test database)
IS_SQLITE = DATABASE_URL.startswith("sqlite")
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

# Create engine with appropriate settings
if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={
            "check_same_thread": False,
            "timeout": 20,
        },
        poolclass=StaticPool,
    )
else:
    # PostgreSQL configuration
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        poolclass=QueuePool,
    )

# Enable foreign key constraints and optimizations for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable SQLite optimizations and constraints"""
    if IS_SQLITE:
        cursor = dbapi_connection.cursor()
        
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys=ON")
        
        # Performance optimizations
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=10000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA mmap_size=268435456")
        
        cursor.close()

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base
Base = declarative_base()

def get_database():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_all_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ All database tables created successfully!")

def drop_all_tables():
    """Drop all database tables (use with caution!)"""
    Base.metadata.drop_all(bind=engine)
    print("⚠️ All database tables dropped!")

def get_database_info():
    """Get information about the database"""
    db_path = DB_DIR / "crypto_portfolio.db"
    
    if db_path.exists():
        size_mb = db_path.stat().st_size / (1024 * 1024)
        return {
            "path": str(db_path),
            "size_mb": round(size_mb, 2),
            "exists": True
        }
    else:
        return {
            "path": str(db_path),
            "size_mb": 0,
            "exists": False
        }