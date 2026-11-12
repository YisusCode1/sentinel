from decimal import Decimal

from app.schemas.operation import OperationRequest
from app.schemas.policy import PolicyResponse
from app.services.policy_engine import evaluate_operation

EVM = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"


def make_policy(**overrides):
    data = dict(
        id="policy-1",
        name="Test policy",
        max_amount=Decimal("500"),
        allowed_tokens=["USDT"],
        allowed_recipients=[EVM],
        allowed_operations=["transfer"],
        active=True,
    )
    data.update(overrides)
    return PolicyResponse(**data)


def make_op(**overrides):
    data = dict(
        policy_id="policy-1",
        network="near",
        operation="transfer",
        token="USDT",
        amount=Decimal("10"),
        recipient=EVM,
    )
    data.update(overrides)
    return OperationRequest(**data)


def test_valid_operation_is_approved():
    assert evaluate_operation(make_op(), make_policy()).decision == "approved"


def test_amount_equal_to_limit_is_approved():
    assert evaluate_operation(make_op(amount=Decimal("500")), make_policy()).decision == "approved"


def test_amount_above_limit_is_rejected():
    result = evaluate_operation(make_op(amount=Decimal("500.00000001")), make_policy())
    assert result.decision == "rejected"
    assert result.reason == "Amount exceeds policy limit"


def test_inactive_policy_is_rejected():
    result = evaluate_operation(make_op(), make_policy(active=False))
    assert result.decision == "rejected"
    assert result.reason == "Policy is inactive"


def test_token_case_and_spaces_are_normalized():
    assert evaluate_operation(make_op(token=" usdt "), make_policy()).decision == "approved"


def test_token_not_allowed_is_rejected():
    result = evaluate_operation(make_op(token="DAI"), make_policy())
    assert result.reason == "Token is not allowed"


def test_operation_not_allowed_is_rejected():
    result = evaluate_operation(make_op(operation="swap"), make_policy())
    assert result.reason == "Operation type is not allowed"


def test_unknown_recipient_is_rejected():
    result = evaluate_operation(make_op(recipient="0x" + "1" * 40), make_policy())
    assert result.reason == "Recipient is not allowed"


def test_evm_recipient_is_case_insensitive():
    assert evaluate_operation(make_op(recipient=EVM.lower()), make_policy()).decision == "approved"


def test_non_evm_recipient_is_case_sensitive():
    policy = make_policy(allowed_recipients=["alice.near"])
    assert evaluate_operation(make_op(recipient="alice.near"), policy).decision == "approved"
    assert evaluate_operation(make_op(recipient="Alice.near"), policy).decision == "rejected"