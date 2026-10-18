from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import engine, Base, SessionLocal
from app.config import settings
from app.routers import auth, folders, questions, solutions, bookmarks, progress, search, test_cases
from app.services.seed_service import seed_demo_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dsa_tracker")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)

    # Seed demo data if database is empty
    db = SessionLocal()
    try:
        seed_demo_data(db)
        logger.info("Seed data verified.")
    except Exception as e:
        logger.warning(f"Seed initialization note: {e}")
    finally:
        db.close()

    yield

app = FastAPI(
    title="DSA Learning Tracker API",
    description="Backend API for DSA Learning Tracker with recursive folders, notes, Monaco editor solutions, and bookmarks",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
origins = [
    settings.CLIENT_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(solutions.router, prefix="/api")
app.include_router(bookmarks.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(test_cases.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "DSA Learning Tracker API",
        "database": str(engine.url.database or engine.url),
        "version": "1.0.0"
    }

@app.get("/")
def root():
    return {"message": "DSA Learning Tracker API is running. Visit /docs for Swagger documentation."}
