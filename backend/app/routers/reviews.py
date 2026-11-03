"""Spaced-repetition review queue."""
from datetime import timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.db import get_db, now_iso
from app.routers.auth import CurrentUser, get_current_user
from app.schemas.question import QuestionListItem
from app.schemas.review import DueReviewsResponse, ReviewRequest
from app.services.repo import FolderPaths, bookmarked_ids, get_owned_question, to_list_item
from app.services.tracking import (
    end_of_local_day_iso,
    get_user_tz,
    local_today,
    record_activity,
    review_updates,
    start_of_local_day_iso,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])

PROJECTION = {"_id": 0, "problem_statement": 0, "notes": 0}


@router.get("/due", response_model=DueReviewsResponse)
def due_reviews(db: Database = Depends(get_db), current_user: CurrentUser = Depends(get_current_user), tz: ZoneInfo = Depends(get_user_tz)):
    uid = current_user.id
    today = local_today(tz)
    cutoff = end_of_local_day_iso(tz)
    week = end_of_local_day_iso(tz, today + timedelta(days=7))
    due_docs = list(db.questions.find({"user_id": uid, "next_review_at": {"$ne": None, "$lte": cutoff}}, PROJECTION).sort("next_review_at", 1).limit(200))
    upcoming_docs = list(db.questions.find({"user_id": uid, "next_review_at": {"$gt": cutoff, "$lte": week}}, PROJECTION).sort("next_review_at", 1).limit(100))
    reviewed_today = db.activity.count_documents({"user_id": uid, "type": "review", "at": {"$gte": start_of_local_day_iso(tz)}})
    paths = FolderPaths.for_user(db, uid)
    bm = bookmarked_ids(db, uid)
    return DueReviewsResponse(
        due=[to_list_item(q, bm, paths) for q in due_docs],
        upcoming=[to_list_item(q, bm, paths) for q in upcoming_docs],
        due_count=db.questions.count_documents({"user_id": uid, "next_review_at": {"$ne": None, "$lte": cutoff}}),
        reviewed_today=reviewed_today,
    )


@router.post("/{question_id}", response_model=QuestionListItem)
def review_question(question_id: str, body: ReviewRequest, db: Database = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    q = get_owned_question(db, current_user.id, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    updates = review_updates(q, body.rating)
    updates["updated_at"] = now_iso()
    db.questions.update_one({"id": question_id, "user_id": current_user.id}, {"$set": updates})
    record_activity(db, current_user.id, "review", question_id)
    q.update(updates)
    return to_list_item(q, bookmarked_ids(db, current_user.id), FolderPaths.for_user(db, current_user.id))
