from datetime import date, datetime, time, timezone
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import OperationRow, PolicyRow
from .policy_engine import evaluate_policy
from .schemas import OperationCreate, OperationPage, OperationRecord, PolicyCreate, PolicyRecord

router = APIRouter(prefix="/api/v1")


def get_session(request: Request):
    with request.app.state.session_factory() as session:
        yield session


Database = Annotated[Session, Depends(get_session)]


@router.post("/policies", response_model=PolicyRecord, status_code=201)
def create_policy(body: PolicyCreate, session: Database):
    record = PolicyRecord(**body.model_dump(), id=f"policy-{uuid4()}", created_at=datetime.now(timezone.utc).isoformat())
    session.add(PolicyRow(id=record.id, data=record.model_dump()))
    session.commit()
    return record


@router.get("/policies", response_model=list[PolicyRecord])
def list_policies(session: Database):
    return [row.data for row in session.scalars(select(PolicyRow)).all()]


@router.get("/policies/{policy_id}", response_model=PolicyRecord)
def get_policy(policy_id: str, session: Database):
    policy = session.get(PolicyRow, policy_id)
    if policy is None:
        raise HTTPException(404, "La política no existe")
    return policy.data


def existing_evaluation(session: Session, key: str, payload: dict):
    row = session.scalar(select(OperationRow).where(OperationRow.idempotency_key == key))
    if row is not None and row.request != payload:
        raise HTTPException(409, "La clave de envío ya fue utilizada con otros datos")
    return row.data if row is not None else None


@router.post("/operations/evaluate", response_model=OperationRecord, status_code=201)
def evaluate_operation(body: OperationCreate, session: Database, idempotency_key: Annotated[UUID | None, Header()] = None):
    payload = body.model_dump()
    key = str(idempotency_key) if idempotency_key else None
    if key and (existing := existing_evaluation(session, key, payload)):
        return existing
    policy = PolicyRecord.model_validate(get_policy(body.policy_id, session))
    checks = evaluate_policy(body, policy)
    failures = [check.label for check in checks if not check.passed]
    created_at = datetime.now(timezone.utc)
    record = OperationRecord(
        **payload, operation_id=f"op-{uuid4()}", created_at=created_at.isoformat(),
        decision="rejected" if failures else "approved",
        reason=f"No cumple: {', '.join(failures)}." if failures else "La operación cumple todas las condiciones de la política.",
        policy_name=policy.name, policy_snapshot=policy, checks=checks,
    )
    session.add(OperationRow(
        id=record.operation_id, created_at=created_at, decision=record.decision,
        search_text=" ".join([record.operation_id, policy.name, *payload.values()]).lower(),
        idempotency_key=key, request=payload, data=record.model_dump(),
    ))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        if key and (existing := existing_evaluation(session, key, payload)):
            return existing
        raise
    return record


@router.get("/operations", response_model=OperationPage)
def list_operations(
    session: Database,
    q: Annotated[str, Query(max_length=256)] = "",
    decision: Literal["approved", "rejected"] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "La fecha inicial debe ser anterior o igual a la final")
    conditions = []
    if q.strip():
        conditions.append(OperationRow.search_text.contains(q.strip().lower(), autoescape=True))
    if decision:
        conditions.append(OperationRow.decision == decision)
    if date_from:
        conditions.append(OperationRow.created_at >= datetime.combine(date_from, time.min, timezone.utc))
    if date_to:
        # Compare inclusive end-of-day without overflowing date.max.
        conditions.append(OperationRow.created_at <= datetime.combine(date_to, time.max, timezone.utc))
    total, approved, rejected = session.execute(select(
        func.count(OperationRow.id),
        func.sum(case((OperationRow.decision == "approved", 1), else_=0)),
        func.sum(case((OperationRow.decision == "rejected", 1), else_=0)),
    ).where(*conditions)).one()
    rows = session.scalars(select(OperationRow).where(*conditions).order_by(OperationRow.created_at.desc(), OperationRow.id).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [row.data for row in rows], "total": total, "page": page, "page_size": page_size,
            "summary": {"total": total, "approved": approved or 0, "rejected": rejected or 0}}


@router.get("/operations/{operation_id}", response_model=OperationRecord)
def get_operation(operation_id: str, session: Database):
    row = session.get(OperationRow, operation_id)
    if row is None:
        raise HTTPException(404, "La operación no existe")
    return row.data
