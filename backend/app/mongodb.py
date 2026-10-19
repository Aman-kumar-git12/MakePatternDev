import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database
from app.config import settings

logger = logging.getLogger("dsa_tracker.mongodb")

_mongo_client: Optional[pymongo.MongoClient] = None

def get_mongo_client() -> Optional[pymongo.MongoClient]:
    global _mongo_client
    if _mongo_client is None:
        try:
            _mongo_client = pymongo.MongoClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=2000
            )
            # Ping to verify active connection
            _mongo_client.admin.command('ping')
            logger.info("Successfully connected to MongoDB.")
        except Exception as e:
            logger.warning(f"MongoDB connection attempt failed: {e}. Falling back gracefully.")
            _mongo_client = None
    return _mongo_client

def get_mongo_db() -> Optional[Database]:
    client = get_mongo_client()
    if client is not None:
        return client[settings.MONGODB_DB_NAME]
    return None

def get_users_collection() -> Optional[Collection]:
    db = get_mongo_db()
    if db is not None:
        return db["users"]
    return None

def init_mongodb():
    """
    Initializes MongoDB users collection, applies schema validation,
    and creates a unique index on email to guarantee uniqueness.
    """
    db = get_mongo_db()
    if db is None:
        logger.warning("MongoDB not available at init time; proceeding without blocking.")
        return

    try:
        # Check if users collection exists, create with schema validator if not
        collections = db.list_collection_names()
        user_schema_validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["email", "hashed_password"],
                "properties": {
                    "email": {
                        "bsonType": "string",
                        "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                        "description": "must be a valid email string and is required"
                    },
                    "hashed_password": {
                        "bsonType": "string",
                        "description": "must be a string containing hashed password and is required"
                    },
                    "full_name": {
                        "bsonType": "string",
                        "description": "optional user full name"
                    },
                    "created_at": {
                        "bsonType": ["date", "string"],
                        "description": "timestamp of creation"
                    }
                }
            }
        }

        if "users" not in collections:
            db.create_collection("users", validator=user_schema_validator)
            logger.info("Created MongoDB 'users' collection with schema validation.")
        else:
            try:
                db.command("collMod", "users", validator=user_schema_validator)
            except Exception as e:
                logger.debug(f"collMod note: {e}")

        # Ensure unique index on email field
        db.users.create_index("email", unique=True, name="unique_email_idx")
        logger.info("MongoDB unique index on users.email verified successfully.")
    except Exception as e:
        logger.error(f"Error initializing MongoDB collection or index: {e}", exc_info=True)

def find_user_by_email_mongo(email: str) -> Optional[Dict[str, Any]]:
    coll = get_users_collection()
    if coll is not None:
        return coll.find_one({"email": email.strip().lower()})
    return None

def find_user_by_id_mongo(user_id: str) -> Optional[Dict[str, Any]]:
    coll = get_users_collection()
    if coll is not None:
        return coll.find_one({"id": user_id})
    return None

def save_user_mongo(user_id: str, email: str, full_name: str, hashed_password: str) -> bool:
    """
    Persistently stores user into MongoDB with unique email validation.
    """
    coll = get_users_collection()
    if coll is None:
        return False

    normalized_email = email.strip().lower()
    user_doc = {
        "_id": user_id,
        "id": user_id,
        "email": normalized_email,
        "full_name": full_name or "Aman Kumar",
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert or update
    coll.update_one({"_id": user_id}, {"$set": user_doc}, upsert=True)
    return True
