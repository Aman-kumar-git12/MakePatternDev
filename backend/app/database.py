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
        with engine.connect() as conn:
            logger.info("Successfully connected to PostgreSQL database.")
    elif "sqlite" in db_url:
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        logger.info("Database URL is not PostgreSQL or SQLite; using local SQLite database.")
        db_url = "sqlite:///./dsa_tracker.db"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
except Exception as e:
    if settings.SQLITE_FALLBACK:
        logger.warning(f"Could not connect to database ({e}). Falling back to local SQLite database.")
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
