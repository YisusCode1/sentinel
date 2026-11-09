"""Prepare untrusted operation data without logging its contents."""

import re
import unicodedata
from decimal import Decimal, InvalidOperation, localcontext
from typing import Any

from .schemas import OperationAnalysisRequest


_STANDARD_TEXT_LIMIT = 128
_METADATA_TEXT_LIMIT = 300
_INJECTION_PATTERN = re.compile(
    r"ignore\s*(?:all\s*)?previous\s*instructions|system\s*override|\brisk_score\b|\bapprove\b",
    re.IGNORECASE,
)


def sanitize_operation_input(
    request: OperationAnalysisRequest,
) -> tuple[dict[str, Any], bool]:
    """Return a sanitized JSON-compatible copy and a heuristic injection flag.

    Scan complete text before truncating, including nested metadata and keys.
    The flag is advisory: it does not prove an attack or prevent every injection.
    Original request data is preserved for backend policy decisions.
    """
    pre_detected_injection = False

    def sanitize_text(value: str, limit: int) -> str:
        nonlocal pre_detected_injection
        cleaned = "".join(
            char
            for char in value
            if unicodedata.category(char) not in {"Cc", "Cf", "Cs"}
        )
        # Normalize only for detection; preserve visible identifiers in the output.
        detection_text = unicodedata.normalize("NFKC", cleaned)
        if _INJECTION_PATTERN.search(detection_text):
            pre_detected_injection = True
        return cleaned[:limit]

    def sanitize_value(value: Any, limit: int) -> Any:
        if isinstance(value, str):
            return sanitize_text(value, limit)
        if isinstance(value, list):
            return [sanitize_value(item, limit) for item in value]
        if isinstance(value, dict):
            return {
                sanitize_text(key, _STANDARD_TEXT_LIMIT): sanitize_value(item, limit)
                for key, item in value.items()
            }
        return value

    sanitized = {
        field: sanitize_value(
            value,
            _METADATA_TEXT_LIMIT if field == "metadata" else _STANDARD_TEXT_LIMIT,
        )
        for field, value in request.model_dump(mode="json").items()
    }
    return sanitized, pre_detected_injection


def _finite_decimal(value: str | float | Decimal | None) -> Decimal | None:
    """Skip unavailable/invalid numeric context without inventing a zero value."""
    if value is None:
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return number if number.is_finite() else None


def compute_heuristic_signals(request: OperationAnalysisRequest) -> list[str]:
    """Compute advisory comparisons from original values before text truncation.

    Decimal comparisons avoid rounding exact amount strings through binary floats.
    Invalid/nonfinite numeric values yield no numeric signal; absence of a signal
    is not evidence of safety. These signals never make a policy decision.
    """
    signals: list[str] = []
    amount = _finite_decimal(request.amount)
    average = _finite_decimal(request.historical_avg_amount)
    policy_max = _finite_decimal(request.policy_max_amount)
    if amount is not None:
        if average is not None and average > 0:
            # historical_avg_amount is a float; enough precision for its decimal
            # representation times five, independent of the caller's context.
            with localcontext() as context:
                context.prec = max(28, len(average.as_tuple().digits) + 1)
                threshold = average * 5
            if amount >= threshold:
                signals.append("heuristic:amount_exceeds_5x_historical_avg")
        if policy_max is not None and amount > policy_max:
            signals.append("heuristic:exceeds_policy_max_amount")
    if request.allowed_tokens is not None and request.token not in request.allowed_tokens:
        signals.append("heuristic:token_not_in_allowlist")
    return signals
