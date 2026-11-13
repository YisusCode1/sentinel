"""Small demo CLI for the Sentinel AI Engine.

The real SDK is only used in live mode. The mocked mode exercises the orchestration
and guardrails without touching external APIs or requiring any credentials.
"""

from __future__ import annotations

import argparse
import json
from types import SimpleNamespace
from unittest.mock import Mock

from analyzer import service
from analyzer.config import AIEngineSettings, get_settings


RESET = "\033[0m"
GREEN = "\033[32m"
RED = "\033[31m"
BLUE = "\033[34m"


def _mock_client(payload: dict) -> Mock:
    client = Mock()
    client.models = Mock()
    client.models.generate_content = Mock(
        return_value=SimpleNamespace(text=json.dumps(payload))
    )
    return client


def _scenario_low_risk() -> dict:
    return {
        "risk_score": 18,
        "risk_level": "low",
        "flags": [],
        "explanation": "The amount is close to the historical average and the recipient is familiar. The deterministic Policy Engine remains the authority.",
        "evidence": ["amount=40", "historical_avg_amount=40"],
    }


def _scenario_high_risk() -> dict:
    return {
        "risk_score": 82,
        "risk_level": "high",
        "flags": ["unusual_amount", "new_recipient"],
        "explanation": "The amount is 10x the historical average and the recipient is new. Policy Engine checks still decide the final verdict.",
        "evidence": ["amount=5000", "historical_avg_amount=40", "is_new_recipient=true"],
    }


def _scenario_injection() -> dict:
    return {
        "risk_score": 92,
        "risk_level": "critical",
        "flags": ["prompt_injection_suspected"],
        "explanation": "Suspicious instruction injection was detected in the operation metadata. The deterministic Policy Engine remains the final authority.",
        "evidence": ["metadata=prompt-injection-trace"],
    }


def _scenario_fallback() -> dict:
    return {
        "risk_score": 50,
        "risk_level": "unknown",
        "flags": ["ai_analysis_unavailable", "fallback_triggered"],
        "explanation": "AI risk analysis is unavailable due to provider error, timeout, or malformed output. The deterministic Policy Engine has the final decision authority.",
        "evidence": ["error_type:TimeoutError"],
        "analysis_available": False,
    }


def _mock_scenarios():
    return [
        ("Escenario 1", _scenario_low_risk(), GREEN, "LOW RISK"),
        ("Escenario 2", _scenario_high_risk(), RED, "HIGH RISK"),
        ("Escenario 3", _scenario_injection(), RED, "CRITICAL RISK"),
        ("Escenario 4", _scenario_fallback(), BLUE, "FALLBACK"),
    ]


def _print_result(title: str, payload: dict, color: str, label: str, *, use_color: bool) -> None:
    code = color if use_color else ""
    suffix = RESET if use_color else ""
    print(f"{title}")
    print(f"{code}{label}{suffix}")
    print("[SIMULATED]")
    print(f"Score: {payload['risk_score']} | Level: {payload['risk_level']}")
    print(f"Flags: {', '.join(payload.get('flags', [])) or 'none'}")
    print(f"Explanation: {payload['explanation']}")
    print(f"Evidence: {payload.get('evidence', [])}")
    print("Policy Engine: authoritative and deterministic")
    print(f"latency={payload.get('latency_ms', 42)}ms")
    print()


def _run_mock_demo(*, interactive: bool, use_color: bool) -> int:
    for number, (title, payload, color, label) in enumerate(_mock_scenarios(), start=1):
        if interactive:
            input("Presiona Enter para continuar...")
        result = service.analyze_operation(
            {
                "agent_id": "demo-agent",
                "policy_id": f"policy-{number}",
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": str(40 if number == 1 else 5000 if number == 2 else 100),
                "recipient": "demo-recipient",
                "historical_avg_amount": 40.0,
                "is_new_recipient": number in {2, 3},
                "recent_tx_count_1h": 1,
            },
            client=_mock_client(payload),
        )
        _print_result(f"Escenario {number}", result.model_dump(), color, label, use_color=use_color)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Demo for the Sentinel AI Engine.")
    parser.add_argument("--mock", action="store_true", help="Run the offline demo scenarios without credentials.")
    parser.add_argument("--interactive", action="store_true", help="Pause between scenarios.")
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI colors.")
    args = parser.parse_args(argv)

    if args.mock:
        return _run_mock_demo(interactive=args.interactive, use_color=not args.no_color)

    settings = get_settings()
    if settings.GEMINI_API_KEY is None or not settings.GEMINI_API_KEY.get_secret_value().strip():
        parser.error("Missing GEMINI_API_KEY. Re-run with --mock to demo the CLI offline.")

    print("Live Gemini mode is not implemented in this demo CLI.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
