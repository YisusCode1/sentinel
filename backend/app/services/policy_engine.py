import re
from uuid import uuid4

from app.schemas.operation import OperationDecision, OperationRequest
from app.schemas.policy import PolicyResponse

_EVM_ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _normalize(value: str) -> str:
    return value.strip().casefold()


def _is_allowed(value: str, allowed: list[str]) -> bool:
    return _normalize(value) in {_normalize(item) for item in allowed}


def _recipient_allowed(recipient: str, allowed: list[str]) -> bool:
    recipient = recipient.strip()
    for candidate in allowed:
        candidate = candidate.strip()
        if _EVM_ADDRESS.match(recipient) and _EVM_ADDRESS.match(candidate):
            # EVM addresses are case-insensitive (checksum casing is cosmetic).
            if recipient.lower() == candidate.lower():
                return True
        elif recipient == candidate:
            # Other networks (e.g. NEAR): exact match only.
            return True
    return False


def evaluate_operation(
    operation: OperationRequest,
    policy: PolicyResponse,
) -> OperationDecision:
    def decide(decision: str, reason: str) -> OperationDecision:
        return OperationDecision(
            operation_id=str(uuid4()),
            decision=decision,
            reason=reason,
            policy_id=policy.id,
        )

    if not policy.active:
        return decide("rejected", "Policy is inactive")

    if not _is_allowed(operation.operation, policy.allowed_operations):
        return decide("rejected", "Operation type is not allowed")

    if not _is_allowed(operation.token, policy.allowed_tokens):
        return decide("rejected", "Token is not allowed")

    if not _recipient_allowed(operation.recipient, policy.allowed_recipients):
        return decide("rejected", "Recipient is not allowed")

    if operation.amount > policy.max_amount:
        return decide("rejected", "Amount exceeds policy limit")

    return decide("approved", "Operation complies with policy")