from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings
import logging

logger = logging.getLogger(__name__)

engine = None
db_url = settings.DATABASE_URL

try:
    if "postgresql" in db_url:
        # Test postgresql connection
        engine = create_engine(db_url, pool_pre_ping=True)
        # Attempt connection test
        with engine.connect() as conn:
            logger.info("Successfully connected to PostgreSQL database.")
    else:
        engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
except Exception as e:
    if settings.SQLITE_FALLBACK:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to local SQLite database.")
        db_url = "sqlite:///./dsa_tracker.db"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
