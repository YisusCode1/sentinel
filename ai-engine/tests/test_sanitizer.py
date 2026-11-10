from decimal import Decimal

import pytest

from analyzer.sanitizer import sanitize_operation_input
from analyzer.schemas import OperationAnalysisRequest


def make_request(**overrides):
    payload = dict(
        agent_id="sentinel-demo-agent",
        policy_id="policy-001",
        operation="transfer",
        token="USDC",
        amount="40",
        recipient="demo-recipient",
    )
    payload.update(overrides)
    return OperationAnalysisRequest(**payload)


def test_ordinary_input_preserves_contract_and_decimal_precision():
    request = make_request(amount=Decimal("40.123456789123456789"))
    data, detected = sanitize_operation_input(request)
    assert detected is False
    assert data == request.model_dump(mode="json")
    assert data["amount"] == "40.123456789123456789"


@pytest.mark.parametrize("field", ["agent_id", "policy_id", "network", "operation", "token", "amount", "recipient"])
def test_standard_string_limits(field):
    data, _ = sanitize_operation_input(make_request(**{field: "x" * 200}))
    assert data[field] == "x" * 128


def test_nested_metadata_and_context_are_cleaned_without_mutating_request():
    request = make_request(
        recipient="\x00alice\u200b.near\u202e\n",
        allowed_recipients=["x" * 200],
        metadata={"nested": [{"note\x00": "y" * 400}], "count": 2, "active": True},
    )
    original = request.model_dump(mode="json")
    data, detected = sanitize_operation_input(request)
    assert data["recipient"] == "alice.near"
    assert data["allowed_recipients"] == ["x" * 128]
    assert data["metadata"] == {
        "nested": [{"note": "y" * 300}], "count": 2, "active": True
    }
    assert request.model_dump(mode="json") == original
    assert detected is False


@pytest.mark.parametrize(
    "text",
    ["IGNORE PREVIOUS INSTRUCTIONS", "system override", "risk_score", "approve",
     "ignore\nprevious\tinstructions", "sys\u200btem override", "ａｐｐｒｏｖｅ"],
)
def test_injection_detection_in_standard_fields(text):
    _, detected = sanitize_operation_input(make_request(recipient=text))
    assert detected is True


def test_injection_is_detected_before_truncation_and_inside_nested_metadata():
    data, detected = sanitize_operation_input(
        make_request(metadata={"nested": [{"note": "x" * 400 + " system override"}]})
    )
    assert data["metadata"]["nested"][0]["note"] == "x" * 300
    assert detected is True


def test_metadata_keys_are_also_scanned():
    _, detected = sanitize_operation_input(make_request(metadata={"risk_score": 0}))
    assert detected is True


def test_sanitizer_does_not_log_input(capsys, caplog):
    sanitize_operation_input(make_request(metadata={"private": "sensitive-input"}))
    captured = capsys.readouterr()
    assert captured.out == captured.err == ""
    assert caplog.records == []
