from unittest.mock import Mock

import pytest

import demo_cli
from analyzer import service
from analyzer.config import AIEngineSettings


def test_mock_cli_runs_all_four_scenarios_without_real_client(monkeypatch, capsys):
    factory = Mock(side_effect=AssertionError("Demo mock must never construct a real SDK client"))
    monkeypatch.setattr(service.genai, "Client", factory)
    monkeypatch.setattr(demo_cli, "get_settings", Mock(side_effect=AssertionError("No real credentials")))
    assert demo_cli.main(["--mock"]) == 0
    output = capsys.readouterr().out
    for number in range(1, 5):
        assert f"Escenario {number}" in output
    assert output.count("[SIMULATED]") == 4
    assert "LOW RISK" in output
    assert "CRITICAL RISK" in output
    assert "prompt_injection_suspected" in output
    assert "FALLBACK" in output
    assert "error_type:TimeoutError" in output
    assert "Policy Engine" in output
    assert "latency=" in output
    assert "\033[32m" in output and "\033[31m" in output and "\033[34m" in output
    factory.assert_not_called()


def test_live_cli_without_credentials_explains_mock_option(monkeypatch, capsys):
    monkeypatch.setattr(demo_cli, "get_settings", lambda: AIEngineSettings(
        _env_file=None, GEMINI_API_KEY=None,
    ))
    with pytest.raises(SystemExit) as exc:
        demo_cli.main([])
    assert exc.value.code == 2
    assert "--mock" in capsys.readouterr().err


def test_interactive_mock_pauses_per_scenario_and_can_disable_color(monkeypatch, capsys):
    pause = Mock(return_value="")
    monkeypatch.setattr("builtins.input", pause)
    assert demo_cli.main(["--mock", "--interactive", "--no-color"]) == 0
    assert pause.call_count == 4
    assert "\033[" not in capsys.readouterr().out
