from uuid import uuid4
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.auth import get_authenticated_agent
from app.core.database import get_db
from app.models import Agent, Policy, OperationRecord
from app.services.ai_client import analyze_with_ai, chat_with_ai
from app.schemas.assistant import AssistantRequest, AssistantResponse
from app.schemas.policy import PolicyCreate, PolicyResponse
from app.schemas.operation import (
    OperationRequest,
    OperationDecision,
    OperationRecordResponse,
)
from app.services.policy_engine import evaluate_operation


app = FastAPI(
    title="Sentinel API",
    description="AI Agent Security Infrastructure",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["X-API-Key", "Content-Type"],
)


# ============================================================
# PUBLIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "project": "Sentinel",
        "message": "AI Agent Security Infrastructure",
        "status": "running",
    }


@app.get("/api/v1/health")
def health():
    return {
        "status": "healthy",
        "service": "sentinel-backend",
    }


# ============================================================
# POLICIES
# All policy operations require an authenticated agent.
# ============================================================

@app.post(
    "/api/v1/policies",
    response_model=PolicyResponse,
)
def create_policy(
    policy_data: PolicyCreate,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
):
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


@app.get(
    "/api/v1/policies/{policy_id}",
    response_model=PolicyResponse,
)
def get_policy(
    policy_id: str,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
):
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


# ============================================================
# OPERATIONS
# The authenticated agent is always the owner.
# ============================================================

@app.post(
    "/api/v1/operations/evaluate",
    response_model=OperationDecision,
)
def evaluate(
    operation: OperationRequest,
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
):
    # A policy belonging to another agent is indistinguishable
    # from a nonexistent policy.
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

    # Deterministic Policy Engine remains authoritative.
    decision = evaluate_operation(
        operation=operation,
        policy=policy_response,
    )

    # Compare only this agent's same-token, same-network history.
    history = db.query(OperationRecord).filter(
        OperationRecord.agent_id == agent.id,
        OperationRecord.network == operation.network,
        OperationRecord.token == operation.token,
    )
    average = history.filter(OperationRecord.decision == "approved").with_entities(
        func.avg(OperationRecord.amount)
    ).scalar()
    ai_analysis = analyze_with_ai(
        operation=operation, policy=policy_response, agent_id=agent.id,
        history_context={
            "historical_avg_amount": float(average) if average is not None else None,
            "is_new_recipient": history.filter(OperationRecord.recipient == operation.recipient).first() is None,
            "recent_tx_count_1h": history.filter(
                OperationRecord.created_at >= datetime.now(timezone.utc) - timedelta(hours=1)
            ).count(),
        },
    )
    decision = decision.model_copy(update={"ai_analysis": ai_analysis})

    # Never trust an agent_id supplied by the client.
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
        ai_analysis=ai_analysis.model_dump(mode="json"),
    )

    db.add(operation_record)
    db.commit()

    return decision


@app.get(
    "/api/v1/operations",
    response_model=list[OperationRecordResponse],
)
def get_operations(
    decision: str | None = Query(
        default=None,
        pattern="^(approved|rejected)$",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    agent: Agent = Depends(get_authenticated_agent),
    db: Session = Depends(get_db),
):
    # The authenticated agent is the only permitted scope.
    query = db.query(OperationRecord).filter(
        OperationRecord.agent_id == agent.id
    )

    if decision is not None:
        query = query.filter(
            OperationRecord.decision == decision
        )

    operations = (
        query
        .order_by(OperationRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    return operations


@app.get("/api/v1/policies", response_model=list[PolicyResponse])
def list_policies(agent: Agent = Depends(get_authenticated_agent), db: Session = Depends(get_db)):
    return db.query(Policy).filter(Policy.agent_id == agent.id).order_by(Policy.id).limit(200).all()


@app.post("/api/v1/assistant/chat", response_model=AssistantResponse)
def assistant(request: AssistantRequest, agent: Agent = Depends(get_authenticated_agent),
              db: Session = Depends(get_db)):
    operations = db.query(OperationRecord).filter(OperationRecord.agent_id == agent.id)
    selected = None
    if request.operation_id:
        selected = operations.filter(OperationRecord.id == request.operation_id).first()
        if selected is None:
            raise HTTPException(status_code=404, detail="Operation not found")
    recent = operations.order_by(OperationRecord.created_at.desc()).limit(20).all()
    policies = db.query(Policy).filter(Policy.agent_id == agent.id, Policy.active.is_(True)).limit(20).all()
    context = {
        "scope": "authenticated_agent_only; at most 20 recent operations and 20 active policies",
        "agents": [{"id": agent.id, "name": agent.name, "active": agent.active}],
        "operations": [OperationRecordResponse.model_validate(op).model_dump(mode="json") for op in recent],
        "selected_operation": OperationRecordResponse.model_validate(selected).model_dump(mode="json") if selected else None,
        "policies": [PolicyResponse.model_validate(p).model_dump(mode="json") for p in policies],
    }
    return chat_with_ai(request, context)
