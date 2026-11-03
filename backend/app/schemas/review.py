from typing import List, Literal

from pydantic import BaseModel

from app.schemas.question import QuestionListItem

Rating = Literal["again", "hard", "good", "easy"]


class ReviewRequest(BaseModel):
    rating: Rating


class DueReviewsResponse(BaseModel):
    due: List[QuestionListItem]
    upcoming: List[QuestionListItem]
    due_count: int
    reviewed_today: int
