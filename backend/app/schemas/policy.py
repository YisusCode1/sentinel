from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ShortStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class PolicyCreate(BaseModel):
    # Igual que OperationRequest: rechaza campos inesperados (agent_id, active, id...).
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=3, max_length=100)
    max_amount: Decimal = Field(gt=0, max_digits=20, decimal_places=8)

    allowed_tokens: list[ShortStr] = Field(min_length=1, max_length=50)
    allowed_recipients: list[ShortStr] = Field(min_length=1, max_length=200)
    allowed_operations: list[ShortStr] = Field(min_length=1, max_length=50)


class PolicyResponse(PolicyCreate):
    # Permite PolicyResponse.model_validate(policy) directamente desde el modelo SQLAlchemy.
    model_config = ConfigDict(from_attributes=True)

    id: str
    active: bool = True