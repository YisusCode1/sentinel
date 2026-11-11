from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)
    operation_id: str | None = Field(default=None, min_length=1, max_length=36)


class AssistantResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=8000)
    suggested_rules: list[str] = Field(default_factory=list, max_length=6)
    mode: Literal["llm", "demo", "unavailable"]
    model_used: str | None = None
    warnings: list[str] = Field(default_factory=list)
