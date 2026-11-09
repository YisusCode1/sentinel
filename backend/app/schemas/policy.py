from decimal import Decimal
from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)

    max_amount: Decimal = Field(gt=0)

    allowed_tokens: list[str] = Field(min_length=1)

    allowed_recipients: list[str] = Field(min_length=1)

    allowed_operations: list[str] = Field(min_length=1)


class PolicyResponse(PolicyCreate):
    id: str
    active: bool = True