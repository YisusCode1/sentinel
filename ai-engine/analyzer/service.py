"""Gemini risk analysis with validated output and controlled provider fallbacks."""

import asyncio
import logging
import math
import re
import time
import unicodedata
from typing import Any

from google import genai
from google.genai import types

from .config import AIEngineSettings, get_settings
from .prompts import SYSTEM_INSTRUCTION, build_user_prompt
from .sanitizer import compute_heuristic_signals, sanitize_operation_input
from .schemas import (
    GeminiStructuredOutput,
    OperationAnalysisRequest,
    RiskAnalysisResponse,
)


_LOGGER = logging.getLogger(__name__)
_FINAL_STATUS = (
    r"(?:approved|rejected|authorized|denied|blocked|"
    r"on[\s\-\u2010-\u2015]*chain\s+verified|"
    r"verified\s+on[\s\-\u2010-\u2015]*chain)"
)
_AFFIRMATIVE_CLAIM = re.compile(
    rf"\b(?:the\s+|this\s+)?(?:operation|transaction|transfer|request|it)\s+"
    rf"(?:(?:is|was|has\s+been|will\s+be)\s+)?"
    rf"(?:(?:hereby|now|fully|already|successfully)\s+)*{_FINAL_STATUS}\b"
    r"|\b(?:i|we|sentinel|the\s+ai)\s+(?:(?:have|has|hereby)\s+)*"
    r"(?:approve[ds]?|reject(?:ed|s)?|authoriz(?:e[ds]?|ing)|deny|denied|block(?:ed|s)?)"
    r"\s+(?:the|this)\s+(?:operation|transaction|transfer|request)\b"
    rf"|^\s*{_FINAL_STATUS}\s*[.!]?\s*$",
    re.IGNORECASE,
)
_NONASSERTIVE_PREFIX = re.compile(
    r"\b(?:no|neither|if|whether|not\s+true\s+that|false\s+that)\s*$", re.IGNORECASE
)
_HISTORY_FIELDS = ("historical_avg_amount", "is_new_recipient", "recent_tx_count_1h")
_FALLBACK_EXPLANATION = (
    "AI risk analysis is unavailable due to provider error, timeout, or malformed "
    "output. Deferring strictly to the deterministic Policy Engine."
)


def _fallback(exc: Exception) -> RiskAnalysisResponse:
    # Do not include exception messages, tracebacks, payloads, or credentials.
    _LOGGER.warning("AI risk analysis unavailable: %s", type(exc).__name__)
    return RiskAnalysisResponse(
        risk_score=50,
        risk_level="unknown",
        flags=["ai_analysis_unavailable", "fallback_triggered"],
        explanation=_FALLBACK_EXPLANATION,
        evidence=[f"error_type:{type(exc).__name__}"],
        analysis_available=False,
    )


def _contains_forbidden_output(text: str) -> bool:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = "".join(
        char for char in normalized
        if char.isspace() or unicodedata.category(char) not in {"Cc", "Cf", "Cs"}
    )
    # Underscores may occur in flags. Match claims, not isolated keywords in a
    # negative explanation: "operation is not approved" cannot match the verb chain.
    normalized = normalized.replace("_", " ")
    return any(
        not _NONASSERTIVE_PREFIX.search(normalized[:match.start()])
        for match in _AFFIRMATIVE_CLAIM.finditer(normalized)
    )


def _apply_output_guardrails(
    output: GeminiStructuredOutput,
    sanitized_data: dict[str, Any],
    pre_detected_injection: bool,
) -> GeminiStructuredOutput:
    sanitized = _contains_forbidden_output(output.explanation)
    if sanitized:
        # Replacing the full narrative avoids leaving a misleading partial claim.
        output.explanation = (
            "[Advisory Note]: The provider narrative contained unsupported decision or verification "
            "language and was omitted. This assessment is advisory; the "
            "deterministic Policy Engine determines policy decisions."
        )
    original_evidence = output.evidence
    original_flags = output.flags
    output.evidence = [
        item for item in output.evidence if not _contains_forbidden_output(item)
    ]
    output.flags = [
        item for item in output.flags if not _contains_forbidden_output(item)
    ]
    if sanitized or output.evidence != original_evidence or output.flags != original_flags:
        if "output_guardrail_sanitized" not in output.flags:
            output.flags.append("output_guardrail_sanitized")

    if pre_detected_injection or "prompt_injection_suspected" in output.flags:
        if "prompt_injection_suspected" not in output.flags:
            output.flags.append("prompt_injection_suspected")
        output.risk_score = max(output.risk_score, 90)
        output.risk_level = "critical"
        output.explanation += " Potential prompt injection was detected in the payload."

    missing_history = [
        field for field in _HISTORY_FIELDS if sanitized_data.get(field) is None
    ]
    if missing_history:
        if "limited_historical_context" not in output.flags:
            output.flags.append("limited_historical_context")
        output.explanation += (
            " Historical context is unavailable for: " + ", ".join(missing_history) + "."
        )
    return output


def _prepare_operation(
    request: OperationAnalysisRequest | dict[str, Any],
) -> tuple[dict[str, Any], bool, list[str]]:
    if not isinstance(request, (OperationAnalysisRequest, dict)):
        raise ValueError("request must be an OperationAnalysisRequest or a dictionary")
    if isinstance(request, dict):
        request = OperationAnalysisRequest.model_validate(request)
    signals = compute_heuristic_signals(request)
    data, injection = sanitize_operation_input(request)
    return data, injection, signals


def _provider_settings() -> tuple[AIEngineSettings, str, types.HttpOptions]:
    settings = get_settings()
    api_key = (
        settings.GEMINI_API_KEY.get_secret_value()
        if settings.GEMINI_API_KEY is not None
        else ""
    )
    if not api_key.strip():
        raise ValueError("GEMINI_API_KEY is missing or empty")
    timeout_seconds = settings.GEMINI_TIMEOUT_SECONDS
    if not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError("GEMINI_TIMEOUT_SECONDS must be positive and finite")
    return settings, api_key, types.HttpOptions(
        timeout=max(1, int(timeout_seconds * 1000))
    )


def _generation_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=GeminiStructuredOutput,
        temperature=0.1,
    )


def _validate_response(
    text: str,
    sanitized_data: dict[str, Any],
    pre_detected_injection: bool,
    model: str,
) -> RiskAnalysisResponse:
    output = GeminiStructuredOutput.model_validate_json(text)
    output = _apply_output_guardrails(output, sanitized_data, pre_detected_injection)
    return RiskAnalysisResponse(
        **output.model_dump(), analysis_available=True, model_used=model
    )


def _close_sync_client(client: Any) -> None:
    try:
        client.close()
    except Exception as exc:
        _LOGGER.warning("AI client cleanup failed: %s", type(exc).__name__)


def analyze_operation(
    request: OperationAnalysisRequest | dict[str, Any], client: Any | None = None
) -> RiskAnalysisResponse:
    """Analyze synchronously; invalid requests remain caller errors.

    An API key is required even when a client is injected. The caller owns an
    injected client; only clients created here are closed here. Provider failures
    yield an unavailable analysis, never a policy decision.
    """
    started = time.perf_counter()
    sanitized_data, pre_detected_injection, signals = _prepare_operation(request)

    owned_client = None
    try:
        settings, api_key, http_options = _provider_settings()
        user_prompt = build_user_prompt(sanitized_data, pre_detected_injection, signals)
        if client is None:
            owned_client = genai.Client(
                api_key=api_key,
                http_options=http_options,
            )
            client = owned_client

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=user_prompt,
            config=_generation_config(),
        )
        result = _validate_response(
            response.text, sanitized_data, pre_detected_injection, settings.GEMINI_MODEL
        )
    except Exception as exc:
        result = _fallback(exc)
    finally:
        if owned_client is not None:
            _close_sync_client(owned_client)
    result.latency_ms = max(0, int((time.perf_counter() - started) * 1000))
    return result


async def analyze_operation_async(
    request: OperationAnalysisRequest | dict[str, Any], client: Any | None = None
) -> RiskAnalysisResponse:
    """Analyze with the async SDK, sharing synchronous validation and guardrails.

    Inject a genai.Client-compatible object exposing aio.models.generate_content.
    Injected clients remain caller-owned. Task cancellation propagates to the
    caller rather than becoming an unavailable-analysis result.
    """
    started = time.perf_counter()
    sanitized_data, pre_detected_injection, signals = _prepare_operation(request)
    owned_client = None
    try:
        settings, api_key, http_options = _provider_settings()
        user_prompt = build_user_prompt(sanitized_data, pre_detected_injection, signals)
        if client is None:
            owned_client = genai.Client(api_key=api_key, http_options=http_options)
            client = owned_client
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=user_prompt,
                config=_generation_config(),
            ),
            timeout=settings.GEMINI_TIMEOUT_SECONDS,
        )
        result = _validate_response(
            response.text, sanitized_data, pre_detected_injection, settings.GEMINI_MODEL
        )
    except Exception as exc:
        result = _fallback(exc)
    finally:
        if owned_client is not None:
            try:
                await owned_client.aio.aclose()
            except Exception as exc:
                _LOGGER.warning("AI async client cleanup failed: %s", type(exc).__name__)
            finally:
                _close_sync_client(owned_client)
    result.latency_ms = max(0, int((time.perf_counter() - started) * 1000))
    return result
