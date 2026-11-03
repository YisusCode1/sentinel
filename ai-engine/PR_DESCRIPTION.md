# feat(ai): add advisory Gemini analysis, timeout telemetry, and demo CLI

Base branch: `main`

Working branch: `ia-Gemini`

## Summary

Adds `ai-engine/` so backend orchestration can request typed, advisory risk
information for NEAR agent operations. Successful analyses return a bounded risk
score, level, flags, explanation, evidence, availability, model name, and elapsed
`latency_ms`. Missing
credentials, provider failures, timeouts, and malformed output return an explicit
unavailable-analysis response instead of interrupting policy evaluation.

AI never approves/rejects operations, changes policy, or determines signature
requirements. The deterministic Policy Engine remains responsible for decisions.
Backend routes and Docker integration are documented recipes; this PR does not
implement or connect a Policy Engine or deploy an evaluation endpoint.

## Model behavior and configuration

- Uses only the official `google-genai` SDK (`from google import genai`).
- Default model: `gemini-2.5-flash`; temperature: `0.1`.
- Requests `application/json` with `response_schema=GeminiStructuredOutput` and
  validates `response.text` again with Pydantic v2. Scores are integers in 0–100,
  output levels are bounded literals, and unexpected provider fields are rejected.
- Environment configuration: optional `GEMINI_API_KEY`, `GEMINI_MODEL`, and
  `GEMINI_TIMEOUT_SECONDS` (default `5.0`, converted to SDK HTTP milliseconds).
- Loads both cwd `.env` and the absolute module `.env`; the latter overrides
  duplicate file values, while process environment variables override both.
- Exposes `analyze_operation` and `analyze_operation_async`; the async API awaits
  `client.aio.models.generate_content` inside `asyncio.wait_for` with the configured
  timeout. Deadline expiration returns the same controlled fallback. External
  task cancellation propagates. Both APIs share validation and guardrails.
- Adds optional `latency_ms` to `RiskAnalysisResponse`, populated on success and
  fallback using `time.perf_counter()`, including request preparation and cleanup.
- Computes decimal-safe advisory signals for amount >= 5x historical average,
  amount above the supplied policy maximum, and tokens outside a supplied allowlist.
  Signals are computed before truncation and supplied separately in the prompt.
- Missing historical context is explicit in `explanation` and marked with
  `limited_historical_context`.
- Suspected prompt injection on a successful analysis forces a minimum score of
  90, level `critical`, and `prompt_injection_suspected`, even if the provider
  returns an inconsistent low score.
- Invalid initial input raises a clear validation error. Provider/configuration
  failures return score 50, level `unknown`, flags `ai_analysis_unavailable` and
  `fallback_triggered`, `analysis_available=false`, and `model_used=null`.
  The fixed fallback score is not a measured risk or an authorization.

## Security mechanisms

- Treats operation strings, context lists, and nested metadata as untrusted.
  Removes control/format characters and caps standard strings at 128 characters
  and metadata values at 300; scans for injection patterns before truncation.
- Delimits JSON with `<untrusted_operation_payload>` and escapes literal angle
  brackets in payload values to prevent literal delimiter breakout.
- System instructions prohibit policy decisions, policy bypasses, and invented
  NEAR verification, hashes, or network state. Semantic output guardrails rewrite
  matched affirmative claims, add `[Advisory Note]: ` and
  `output_guardrail_sanitized`, and preserve legitimate negations such as
  "not approved" and "not on-chain verified".
- `SecretStr` masks normal key representations. Warning logs include only the
  exception type, without payloads, exception messages, secrets, or tracebacks.
- Preserves original request data for deterministic policy checks. The integration
  recipe accepts only operation fields from HTTP callers and obtains analysis
  context from a trusted backend adapter.
- Closes internally created SDK clients, awaiting async resource cleanup when
  applicable; caller-injected clients remain owned by their caller.

## Backend handoff

[README.md](README.md) provides English/Spanish setup, environment configuration,
typed JSON examples, exact test commands, and a copyable FastAPI router recipe.
The recipe retains the draft contract's deterministic fields, adds `ai_analysis`,
and returns `503` until the backend owner connects a real policy adapter. Its
response extension must be coordinated before frontend integration.

Docker instructions add `./ai-engine:/app/ai_engine`, explicitly pass environment
variables, and install AI dependencies. Mounting alone is insufficient; the
development startup command requires package-registry access. Deployment should
install dependencies in the image build.

## Pitch demo

Run `python ai-engine/demo_cli.py --mock` from the repository root for four offline
scenarios: routine transfer, financial anomaly, prompt injection, and timeout.
Default mode calls Gemini for the first three scenarios when a key is configured;
`--interactive` pauses between scenarios and `--no-color` disables ANSI colors.
Scenario 4 always injects a simulated timeout. Output distinguishes simulated/live
results and displays measured local latency. The mock injection scenario returns
score zero from the simulated provider to demonstrate correction by the guardrail.
The CLI does not execute transactions or a Policy Engine.

## Known limitations

- Analysis is based solely on off-chain context supplied by the backend. There
  are no independent NEAR RPC calls, on-chain checks, or transaction execution.
- Prompt-injection detection is heuristic and may have false positives and
  negatives. Text guardrails do not prove all generated statements are factual.
- Sanitization is not general secret/PII redaction. Backend owners must allowlist
  context and minimize data sent to Gemini. `SecretStr` is not encryption.
- Scores are advisory, not calibrated probabilities. Low temperature does not
  guarantee deterministic model output or consistent anomaly classification.
- HTTP timeout and the async generation deadline do not guarantee total endpoint
  duration; coroutine cancellation and client cleanup can add time.
  Use a FastAPI sync route for `analyze_operation`, or await
  `analyze_operation_async` in async routes. Offload synchronous policy adapters
  separately when using an async endpoint.
- Dependency lower bounds are not a lockfile. Backend policy semantics,
  authentication, persistence, and transaction enforcement are outside this module.
- Mocked tests verify orchestration and failure behavior, not live model accuracy.
  A live integration test exists but was not executed in this verification.
- Invalid/nonfinite numeric data skips numeric heuristics, and absence of a signal
  does not establish safety. Heuristics do not make policy decisions. Regex-based
  semantic matching still has false positives/negatives and is not full language
  understanding. Mock demo timings are not provider performance measurements.

## Validation

Verified with Python 3.12.15, `google-genai` 2.34.0, and Pydantic 2.14.2.
From the repository root, with the AI dependencies installed:

```powershell
$env:PYTHONPATH = "ai-engine"
python -m pytest ai-engine/tests -v -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

Result: **171 passed, 1 skipped**. `GEMINI_API_KEY` was absent from the process
environment, so the single optional live test was skipped with
`Requires real GEMINI_API_KEY`. No live API quota was consumed.

For an explicitly offline run regardless of environment credentials:

```powershell
python -m pytest ai-engine/tests -q -k "not live_gemini" -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

Coverage includes ordinary and anomalous operation scenarios, timeout and malformed
JSON fallbacks, missing/empty keys, strict output validation, injection detection
and sanitization, advisory output guardrails, missing history, privacy-safe
logging, dotenv discovery from different working directories and precedence,
async deadlines/cancellation/fallbacks, latency on success/failure, precise decimal
heuristic boundaries, legitimate negations, CLI scenarios, client ownership/cleanup, and SDK request
serialization using a mock HTTP transport. Expected low/high scores in mocked scenarios are fixtures, not a live
model benchmark.

## Resumen en español

Se entrega el módulo consultivo `ai-engine/`, con configuración, esquemas tipados,
sanitización, integración con Gemini, guardrails, fallbacks y documentación bilingüe.
La IA nunca reemplaza al Policy Engine. El README explica cómo conectar el backend
real y montar el módulo en Docker; esas recetas no modifican el backend existente.
Se añade la demo CLI de cuatro escenarios, latencia medida, heurísticas decimales,
timeout asíncrono y guardrails que respetan negaciones legítimas.
La suite obtuvo **171 pruebas aprobadas y 1 omitida** (integración en vivo sin clave).
El análisis usa únicamente contexto off-chain del backend y no consulta RPC de NEAR.
