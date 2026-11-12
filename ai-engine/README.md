# Sentinel AI Engine

[🇪🇸 Read the Spanish documentation](../README.es.md)

AI-powered advisory risk analysis service for Sentinel.

Built for the **NEAR Hackathon 2026**, under the
**AI Security & Defense** track.

## Purpose

The AI Engine analyzes blockchain operations and identifies
potential anomalies before or alongside Sentinel's security
orchestration process.

It provides an additional risk assessment layer but never
authorizes, rejects, signs, or executes transactions.

Sentinel's deterministic Policy Engine remains the sole
authority for security decisions.

## Architecture

The service uses FastAPI and Google's Gemini API.

Main components:

- `app/main.py`: FastAPI application and internal authentication.
- `app/analyzer.py`: Async analysis adapter.
- `app/schemas.py`: API request and response contracts.
- `analyzer/service.py`: Gemini integration, validation,
  guardrails, fallback handling, and latency measurement.
- `analyzer/config.py`: Environment-based configuration.
- `analyzer/prompts.py`: System instructions and prompt construction.
- `analyzer/sanitizer.py`: Input sanitization and heuristic signals.
- `analyzer/schemas.py`: Structured Gemini input and output models.
- `tests/`: Unit and integration-oriented service tests.

## Risk Analysis

The service uses Gemini with structured JSON output.

Analysis includes:

- Operation context and policy limits.
- Allowed tokens and recipients.
- Historical transaction context when available.
- Heuristic risk signals.
- Potential prompt injection detection.
- Output validation and decision-language guardrails.

The response includes:

- `risk_score`: Integer between 0 and 100.
- `risk_level`: `low`, `medium`, `high`, `critical`, or `unknown`.
- `flags`: Risk indicators.
- `explanation`: Advisory explanation.
- `evidence`: Supporting input signals.
- `analysis_available`: Whether provider analysis succeeded.
- `model_used`: Model identifier when available.
- `latency_ms`: Analysis execution time.

## Failure Handling

Gemini failures, timeouts, missing credentials, and malformed
provider responses trigger a controlled fallback.

The fallback returns:

- `risk_level: unknown`
- `analysis_available: false`
- `ai_analysis_unavailable`
- `fallback_triggered`

An unavailable AI analysis never changes or overrides
Sentinel's deterministic policy decision.

## Security

The `/analyze` endpoint requires the
`X-Internal-Service-Key` HTTP header.

The key must match the backend's `INTERNAL_SERVICE_KEY`.

The service uses constant-time credential comparison.

Additional protections include:

- Input sanitization.
- Prompt injection detection.
- Structured response validation.
- Output guardrails against unsupported authorization
  and transaction-execution claims.
- No exposure of provider exception messages or credentials
  in fallback responses.

The `/health` endpoint is available without internal
service authentication.

## Configuration

Create the environment file:

```bash
cp .env.example .env