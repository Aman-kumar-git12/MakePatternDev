"""Code execution. Python/JavaScript run in the browser; Judge0 is an optional server-side backend."""
from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import settings
from app.routers.auth import CurrentUser, get_current_user
from app.services import judge0
from app.services.ratelimit import check_rate_limit

router = APIRouter(prefix="/run", tags=["run"])


class RunConfig(BaseModel):
    judge0_enabled: bool
    languages: List[str]


class Judge0Request(BaseModel):
    language: Literal["cpp", "java", "python", "javascript"]
    code: str = Field(min_length=1, max_length=100_000)
    stdin: str = Field(default="", max_length=20_000)


class Judge0Result(BaseModel):
    status: str
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    time: Optional[Union[str, float]] = None
    memory: Optional[Union[int, float]] = None


@router.get("/config", response_model=RunConfig)
def run_config(current_user: CurrentUser = Depends(get_current_user)):
    langs = ["python", "javascript"]
    if settings.judge0_enabled:
        langs += ["cpp", "java"]
    return RunConfig(judge0_enabled=settings.judge0_enabled, languages=langs)


@router.post("/judge0", response_model=Judge0Result)
def run_judge0(body: Judge0Request, current_user: CurrentUser = Depends(get_current_user)):
    check_rate_limit(f"judge0:{current_user.id}", limit=30, window_seconds=60)
    return judge0.run_submission(body.language, body.code, body.stdin)
