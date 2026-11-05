from decimal import Decimal

from .schemas import OperationCreate, PolicyCheck, PolicyRecord


def evaluate_policy(operation: OperationCreate, policy: PolicyRecord) -> list[PolicyCheck]:
    """Exact decimal comparison; all four checks must pass. No AI overrides."""
    return [
        PolicyCheck(code="amount", label="Límite de monto", passed=Decimal(operation.amount) <= Decimal(policy.max_amount), detail=f"Monto: {operation.amount}. Máximo: {policy.max_amount}."),
        PolicyCheck(code="token", label="Token permitido", passed=operation.token in policy.allowed_tokens, detail=f"Token solicitado: {operation.token}."),
        PolicyCheck(code="recipient", label="Destinatario autorizado", passed=operation.recipient in policy.allowed_recipients, detail=f"Destinatario: {operation.recipient}."),
        PolicyCheck(code="operation", label="Tipo de operación", passed=operation.operation in policy.allowed_operations, detail=f"Operación solicitada: {operation.operation}."),
    ]
