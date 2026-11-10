"""Operation evaluation and audit query endpoints."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_authenticated_agent
from app.core.database import get_db
from app.models import Agent, OperationRecord, Policy
from app.schemas.operation import (
    OperationDecision,
    OperationRecordResponse,
    OperationRequest,
)
from app.schemas.policy import PolicyResponse
from app.services.ai_client import evaluate_risk
from app.services.policy_engine import evaluate_operation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operations", tags=["Operations"])


@router.post(
    "/evaluate",
    response_model=OperationDecision,
    summary="Evaluate Operation",
    description=(
        "Evaluates an operation request against the agent's policy. "
        "Orchestrates async AI risk advisory and authoritative Policy Engine decision."
    ),
)
async def evaluate(
    operation: OperationRequest,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> OperationDecision:
    """
    Evaluates an operation with strict security isolation:
    - Identity is derived strictly from X-API-Key (never client payload).
    - Policy must belong to the authenticated agent (cross-tenant 404).
    - Step 1: Query AI Engine for advisory risk context (with fallback on failure).
    - Step 2: Policy Engine decides 'approved' or 'rejected' as sole authority.
    - Step 3: Operation is committed to audit history.
    """
    # 1. Fetch policy strictly scoped to the authenticated agent
    policy = (
        db.query(Policy)
        .filter(
            Policy.id == operation.policy_id,
            Policy.agent_id == agent.id,
        )
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy_response = PolicyResponse.model_validate(
        {
            "id": policy.id,
            "name": policy.name,
            "max_amount": policy.max_amount,
            "allowed_tokens": policy.allowed_tokens,
            "allowed_recipients": policy.allowed_recipients,
            "allowed_operations": policy.allowed_operations,
            "active": policy.active,
        }
    )

    # Paso 1: Consultar IA (ai_client) de forma asíncrona
    ai_analysis = await evaluate_risk(
        operation=operation,
        policy=policy_response,
        agent_id=agent.id,
    )

    # Paso 2: Pasar datos + respuesta de IA al Policy Engine
    decision = evaluate_operation(
        operation=operation,
        policy=policy_response,
        ai_analysis=ai_analysis,
    )

    # Paso 3: Registrar la operación en la base de datos (Historial)
    operation_record = OperationRecord(
        id=decision.operation_id,
        agent_id=agent.id,
        policy_id=policy.id,
        network=operation.network,
        operation=operation.operation,
        token=operation.token,
        amount=operation.amount,
        recipient=operation.recipient,
        decision=decision.decision,
        reason=decision.reason,
        ai_analysis=(
            decision.ai_analysis.model_dump(mode="json")
            if decision.ai_analysis is not None
            else None
        ),
    )

    db.add(operation_record)
    db.commit()

    return decision


@router.get(
    "",
    response_model=list[OperationRecordResponse],
    summary="List Operations History",
    description="Returns audited operations belonging exclusively to the authenticated agent.",
)
def list_operations(
    decision: Literal["approved", "rejected"] | None = Query(
        default=None,
        description="Filter by evaluation decision",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of records to return",
    ),
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> list[OperationRecord]:
    """Retrieves operation history strictly scoped to the authenticated agent."""
    query = db.query(OperationRecord).filter(
        OperationRecord.agent_id == agent.id
    )

    if decision is not None:
        query = query.filter(OperationRecord.decision == decision)

    operations = (
        query.order_by(OperationRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    return operations


@router.get(
    "/{operation_id}",
    response_model=OperationRecordResponse,
    summary="Get Operation Details",
    description="Returns detailed audit information for a specific operation.",
)
def get_operation(
    operation_id: str,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
) -> OperationRecord:
    """Retrieves a single operation record scoped to the authenticated agent."""
    operation = (
        db.query(OperationRecord)
        .filter(
            OperationRecord.id == operation_id,
            OperationRecord.agent_id == agent.id,
        )
        .first()
    )

    if operation is None:
        raise HTTPException(
            status_code=404,
            detail="Operation not found",
        )

    return operation
