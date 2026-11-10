"""Deterministic Policy Engine service.

The Policy Engine is the sole authority for approving or rejecting operations.
It validates business invariants (active status, token whitelist, recipient whitelist,
maximum amount, allowed operation types) deterministically. The AI Engine provides
advisory context, but cannot approve or reject operations.
"""

from uuid import uuid4

from app.schemas.operation import (
    AIAnalysisResponse,
    OperationDecision,
    OperationRequest,
)
from app.schemas.policy import PolicyResponse


def evaluate_operation(
    operation: OperationRequest,
    policy: PolicyResponse,
    ai_analysis: AIAnalysisResponse | None = None,
) -> OperationDecision:
    """
    Evaluates an operation strictly against policy rules.

    Parameters:
        operation: Target operation data.
        policy: Associated policy snapshot belonging to the authenticated agent.
        ai_analysis: Optional advisory risk analysis from the AI Engine.

    Returns:
        OperationDecision with verdict ('approved' or 'rejected'), reason,
        operation_id, policy_id, and attached advisory ai_analysis.
    """
    operation_id = str(uuid4())

    # 1. Active policy check
    if not policy.active:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Policy is inactive",
            policy_id=policy.id,
            ai_analysis=ai_analysis,
        )

    # 2. Maximum amount limit check
    if operation.amount > policy.max_amount:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Amount exceeds policy limit",
            policy_id=policy.id,
            ai_analysis=ai_analysis,
        )

    # 3. Allowed token whitelist check
    if operation.token not in policy.allowed_tokens:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Token is not allowed",
            policy_id=policy.id,
            ai_analysis=ai_analysis,
        )

    # 4. Allowed recipient whitelist check
    if operation.recipient not in policy.allowed_recipients:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Recipient is not allowed",
            policy_id=policy.id,
            ai_analysis=ai_analysis,
        )

    # 5. Allowed operation type whitelist check
    if operation.operation not in policy.allowed_operations:
        return OperationDecision(
            operation_id=operation_id,
            decision="rejected",
            reason="Operation type is not allowed",
            policy_id=policy.id,
            ai_analysis=ai_analysis,
        )

    # All deterministic checks passed
    return OperationDecision(
        operation_id=operation_id,
        decision="approved",
        reason="Operation complies with policy",
        policy_id=policy.id,
        ai_analysis=ai_analysis,
    )
