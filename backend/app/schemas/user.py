import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LEETCODE_USERNAME_RE = re.compile(r"^[A-Za-z0-9_\-.]{1,40}$")


def _normalize_email(v: str) -> str:
    v = (v or "").strip().lower()
    # Any syntactically valid address is accepted; emails are never verified by design.
    if len(v) > 254 or not EMAIL_RE.match(v):
        raise ValueError("Enter an email in the form name@example.com")
    return v


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=72)
    full_name: Optional[str] = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _normalize_email(v)


class UserLogin(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _normalize_email(v)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    leetcode_username: Optional[str] = Field(default=None, max_length=40)

    @field_validator("leetcode_username")
    @classmethod
    def validate_lc(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if v and not LEETCODE_USERNAME_RE.match(v):
            raise ValueError("Invalid LeetCode username")
        return v


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)


class AccountDelete(BaseModel):
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    leetcode_username: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
