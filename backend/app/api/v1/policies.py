"""Policy management endpoints."""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_authenticated_agent
from app.core.database import get_db
from app.models import Agent, Policy
from app.schemas.policy import PolicyCreate, PolicyResponse

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.post(
    "",
    response_model=PolicyResponse,
    status_code=201,
    summary="Create Policy",
    description="Registers a new security policy belonging strictly to the authenticated agent.",
)
def create_policy(
    policy_data: PolicyCreate,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> Policy:
    """Creates a security policy bound to the authenticated agent."""
    policy = Policy(
        id=str(uuid4()),
        agent_id=agent.id,
        name=policy_data.name,
        max_amount=policy_data.max_amount,
        allowed_tokens=policy_data.allowed_tokens,
        allowed_recipients=policy_data.allowed_recipients,
        allowed_operations=policy_data.allowed_operations,
        active=True,
    )

    db.add(policy)
    db.commit()
    db.refresh(policy)

    return policy


@router.get(
    "",
    response_model=list[PolicyResponse],
    summary="List Policies",
    description="Lists all security policies configured by the authenticated agent.",
)
def list_policies(
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> list[Policy]:
    """Returns all policies owned by the authenticated agent."""
    return (
        db.query(Policy)
        .filter(Policy.agent_id == agent.id)
        .order_by(Policy.name)
        .all()
    )


@router.get(
    "/{policy_id}",
    response_model=PolicyResponse,
    summary="Get Policy",
    description="Retrieves a specific policy owned by the authenticated agent.",
)
def get_policy(
    policy_id: str,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> Policy:
    """Retrieves a single policy strictly scoped to the authenticated agent."""
    policy = (
        db.query(Policy)
        .filter(
            Policy.id == policy_id,
            Policy.agent_id == agent.id,
        )
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    return policy
