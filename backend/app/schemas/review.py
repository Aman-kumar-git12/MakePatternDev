from typing import List, Literal

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.question import QuestionListItem

Rating = Literal["again", "hard", "good", "easy"]


class ReviewRequest(BaseModel):
    rating: Rating


class DueReviewsResponse(BaseModel):
    due: List[QuestionListItem]
    upcoming: List[QuestionListItem]
    due_count: int
    reviewed_today: int


class OfflineReview(BaseModel):
    client_id: str = Field(min_length=1, max_length=64)
    question_id: str = Field(min_length=1, max_length=64)
    rating: Rating
    reviewed_at: datetime


class ReviewBatchRequest(BaseModel):
    reviews: List[OfflineReview] = Field(min_length=1, max_length=200)


class ReviewBatchResult(BaseModel):
    client_id: str
    status: Literal["applied", "duplicate", "not_found", "stale"]


class ReviewBatchResponse(BaseModel):
    applied: int
    skipped: int
    results: List[ReviewBatchResult]
