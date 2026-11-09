from uuid import uuid4

from app.schemas.policy import PolicyResponse
from app.schemas.operation import (
    OperationRequest,
    OperationDecision,
)


def evaluate_operation(
    operation: OperationRequest,
    policy: PolicyResponse,
) -> OperationDecision:

    operation_id = str(uuid4())

    if not policy.active:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Policy is inactive",
            policy_id=policy.id,
        )

    if operation.amount > policy.max_amount:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Amount exceeds policy limit",
            policy_id=policy.id,
        )

    if operation.token not in policy.allowed_tokens:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Token is not allowed",
            policy_id=policy.id,
        )

    if operation.recipient not in policy.allowed_recipients:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Recipient is not allowed",
            policy_id=policy.id,
        )

    if operation.operation not in policy.allowed_operations:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Operation type is not allowed",
            policy_id=policy.id,
        )

    return OperationDecision(
        operation_id=operation_id,
        decision="approved",
        reason="Operation complies with policy",
        policy_id=policy.id,
    )