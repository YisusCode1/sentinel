# Sentinel AI Engine

[English](#english) | [Español](#español)

## English

### Purpose and AI boundary

This module provides **advisory risk analysis** for agent operations on NEAR
Protocol. It never approves or rejects operations, changes policies, replaces the
deterministic Policy Engine, or executes transactions. Policy decisions and
signature requirements belong to backend orchestration and the Policy Engine.

The analyzer uses only the off-chain context supplied by the backend. It does not
query NEAR RPC, verify transactions, discover hashes, or inspect current network
state. See [the AI assignment](../docs/doc_ia.md) and
[the draft API contract](../docs/api_contract.md).

### Installation and environment variables

Use Python 3.12. From the repository root, in PowerShell:

```powershell
cd ai-engine
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

On Linux/macOS, use `python3.12 -m venv .venv`, `source .venv/bin/activate`,
and `cp .env.example .env` instead. Run the remaining commands from `ai-engine/`.
Edit `.env` and replace the placeholder with your own key:

```dotenv
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=5.0
```

| Variable | Behavior |
| --- | --- |
| `GEMINI_API_KEY` | Optional at import time. Missing, empty, or whitespace-only keys produce the controlled fallback. The example placeholder is not a working key. |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash`. |
| `GEMINI_TIMEOUT_SECONDS` | Defaults to `5.0`; must be positive and finite. Configures the SDK HTTP timeout and the async generation deadline via `asyncio.wait_for`. Cancellation and client cleanup may extend total endpoint latency. |

`get_settings()` loads both `.env` in the process's **current working directory**
and the absolute `ai-engine/.env` path derived from `config.py`. Both files are
optional; when both define a value, the module's file wins because it is loaded
last. Environment variables take precedence over either file. This allows imports
from `backend/` without changing directories or manually calling `load_dotenv`.
Docker can still supply variables through `env_file`. Never commit `.env`; the root
`.gitignore` ignores it and permits `.env.example`.

The only Gemini SDK dependency is **`google-genai`**, imported with
`from google import genai`. The deprecated `google-generativeai` is not used.

### Backend owner integration: FastAPI

The current backend has only root and health endpoints. The following code is an
**integration recipe**, not an already connected Policy Engine. It preserves the
draft contract's decision fields and adds an `ai_analysis` object; coordinate
this response extension with the backend owner before frontend integration.

Install the AI dependencies into the backend's Python environment too. For local
development, using the activated environment from the installation section:

```powershell
python -m pip install -r ../backend/requirements.txt
```

Copy this complete block to `backend/app/ai_routes.py`. It supports both the local
repository layout and the Docker mount described below. The directory
`ai-engine/` has a hyphen, so add its path and import the Python package
**`analyzer`**, rather than trying to import `ai-engine` or `ai_engine.analyzer`.

```python
# backend/app/ai_routes.py
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

docker_module = Path("/app/ai_engine")
module_root = (
    docker_module if docker_module.is_dir()
    else Path(__file__).resolve().parents[2] / "ai-engine"
)
sys.path.insert(0, str(module_root))

from analyzer import OperationAnalysisRequest, analyze_operation

router = APIRouter()


class EvaluateOperationBody(BaseModel):
    # Context comes from trusted backend storage, not from the HTTP caller.
    model_config = ConfigDict(extra="forbid")
    agent_id: str
    policy_id: str
    network: str = "near-testnet"
    operation: str
    token: str
    amount: str | float | Decimal
    recipient: str


class PolicyEvaluation(BaseModel):
    # Return these fields from the backend's real deterministic adapter.
    operation_id: str
    decision: str
    reason: str
    policy_id: str
    requires_signature: bool
    analysis_context: dict[str, Any] = Field(default_factory=dict)


@router.post("/api/v1/operations/evaluate")
def evaluate_operation(payload: EvaluateOperationBody, request: Request) -> dict[str, Any]:
    evaluator = getattr(request.app.state, "evaluate_policy", None)
    if not callable(evaluator):
        raise HTTPException(status_code=503, detail="Policy Engine adapter is not configured")

    operation = payload.model_dump()
    policy = PolicyEvaluation.model_validate(evaluator(operation.copy()))
    # Context may enrich analysis but cannot overwrite the original operation.
    analysis_request = OperationAnalysisRequest.model_validate(
        {**policy.analysis_context, **operation}
    )
    analysis = analyze_operation(analysis_request)
    # AI output never overwrites the deterministic decision or signature rule.
    return {
        **policy.model_dump(mode="json", exclude={"analysis_context"}),
        "risk_score": analysis.risk_score,
        "ai_analysis": analysis.model_dump(mode="json"),
    }
```

Then add these lines after the existing `app = FastAPI(...)` in
`backend/app/main.py`:

```python
from app.ai_routes import router as ai_router

app.include_router(ai_router)
# Connect your real synchronous adapter during application setup:
# app.state.evaluate_policy = your_existing_policy_adapter
```

The adapter must accept the original operation dictionary and return the
`PolicyEvaluation` fields above, including a persisted `operation_id`. Populate
`analysis_context` from trusted policy/history storage with fields such as
`policy_max_amount`, `allowed_recipients`, `allowed_tokens`,
`historical_avg_amount`, `is_new_recipient`, and `recent_tx_count_1h`. Include only
allowlisted, necessary metadata and remove secrets before sending data to Gemini.
Do not trust caller-provided historical averages or policy limits.

Until the adapter is connected, the endpoint returns `503` and makes no Gemini
call. Its authorization, ownership checks, persistence, real policy semantics,
and transaction execution must be implemented by the backend owner. A fallback
does not approve an operation: `analysis_available=False` means no AI assessment.
The backend's agreed deterministic rules remain responsible for the decision.

The route uses synchronous `def` because `analyze_operation` uses the synchronous
SDK. FastAPI runs such route functions in a thread pool. For an asynchronous
endpoint, **replace the route function above** with the following version (do not
register the same route twice). The existing policy adapter remains synchronous,
so only that call is offloaded; Gemini uses the SDK's async API directly:

```python
from fastapi.concurrency import run_in_threadpool
from analyzer import analyze_operation_async


@router.post("/api/v1/operations/evaluate")
async def evaluate_operation(payload: EvaluateOperationBody, request: Request) -> dict[str, Any]:
    evaluator = getattr(request.app.state, "evaluate_policy", None)
    if not callable(evaluator):
        raise HTTPException(status_code=503, detail="Policy Engine adapter is not configured")
    operation = payload.model_dump()
    policy = PolicyEvaluation.model_validate(
        await run_in_threadpool(evaluator, operation.copy())
    )
    analysis_request = OperationAnalysisRequest.model_validate(
        {**policy.analysis_context, **operation}
    )
    analysis = await analyze_operation_async(analysis_request)
    return {
        **policy.model_dump(mode="json", exclude={"analysis_context"}),
        "risk_score": analysis.risk_score,
        "ai_analysis": analysis.model_dump(mode="json"),
    }
```

Both functions accept `OperationAnalysisRequest | dict` and an optional injected
`genai.Client`-compatible client. Async clients must expose
`client.aio.models.generate_content`. They share validation, prompt configuration,
guardrails, and fallbacks. The service closes internally created async resources
with `await client.aio.aclose()` and closes the sync wrapper too; injected clients
remain caller-owned. Task cancellation propagates instead of becoming a fallback.
Async generation is wrapped in `asyncio.wait_for` using `GEMINI_TIMEOUT_SECONDS`;
expiration cancels the awaited generation and returns the same controlled
fallback. This is a deadline for the provider call, not an absolute wall-clock
limit including cancellation/cleanup. See
[Python's timeout semantics](https://docs.python.org/3.12/library/asyncio-task.html#asyncio.wait_for).
See the
[FastAPI concurrency documentation](https://fastapi.tiangolo.com/async/#path-operation-functions).

For local startup, from the repository root with the same environment activated:

```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Docker Compose integration

Merge the following into the existing `backend` service in `docker-compose.yml`,
preserving its build, ports, `DATABASE_URL`, and `depends_on` settings:

```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - ./ai-engine:/app/ai_engine
    env_file:
      - ./ai-engine/.env
    command:
      - sh
      - -c
      - >-
        pip install --no-cache-dir -r /app/ai_engine/requirements.txt &&
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

This development example installs dependencies at container startup, requiring
package-registry access. A volume alone does not install `google-genai`.
For deployment, install dependencies while building the image instead. The
current build context is `./backend`; copying `../ai-engine` from its Dockerfile
requires changing that context to the repository root and updating `COPY` paths.
The Compose `env_file` explicitly supplies variables to the service; paths are
relative to the Compose file. See
[Docker's environment-variable guide](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).
Once merged, run `docker compose up --build backend` from the repository root.

### Input and output examples

The following JSON examples are shared by both language sections. Inputs target
`analyze_operation`, including context enriched by the backend. The public HTTP
body in the recipe accepts only the seven operation fields. Outputs are
**illustrative, not guaranteed model responses**. Amounts may be strings, floats,
or `Decimal`; prefer decimal strings for exact amounts. Sanitization serializes
`Decimal` as a string.

**Ordinary operation / Operación normal — input / entrada:**

```json
{
  "agent_id": "sentinel-demo-agent",
  "policy_id": "policy-001",
  "network": "near-testnet",
  "operation": "transfer",
  "token": "USDC",
  "amount": "25",
  "recipient": "demo-recipient",
  "policy_max_amount": "100",
  "allowed_recipients": ["demo-recipient"],
  "allowed_tokens": ["USDC"],
  "historical_avg_amount": 30.0,
  "is_new_recipient": false,
  "recent_tx_count_1h": 1
}
```

**Ordinary operation / Operación normal — output / salida:**

```json
{
  "risk_score": 15,
  "risk_level": "low",
  "flags": [],
  "explanation": "Amount 25 is close to the supplied historical average of 30.",
  "evidence": ["amount=25", "historical_avg_amount=30", "is_new_recipient=false"],
  "analysis_available": true,
  "model_used": "gemini-2.5-flash",
  "latency_ms": 420
}
```

**Suspicious operation / Operación sospechosa — input / entrada:**

```json
{
  "agent_id": "sentinel-demo-agent",
  "policy_id": "policy-001",
  "network": "near-testnet",
  "operation": "transfer",
  "token": "USDC",
  "amount": "5000",
  "recipient": "new-recipient.near",
  "policy_max_amount": "100",
  "historical_avg_amount": 40.0,
  "is_new_recipient": true,
  "recent_tx_count_1h": 12
}
```

**Suspicious operation / Operación sospechosa — output / salida:**

```json
{
  "risk_score": 85,
  "risk_level": "high",
  "flags": ["unusual_amount", "new_recipient"],
  "explanation": "Amount 5000 is 125 times the supplied historical average and the recipient is new.",
  "evidence": ["amount=5000", "historical_avg_amount=40", "is_new_recipient=true"],
  "analysis_available": true,
  "model_used": "gemini-2.5-flash",
  "latency_ms": 610
}
```

**Fallback — output / salida (timeout example / ejemplo de timeout):**

```json
{
  "risk_score": 50,
  "risk_level": "unknown",
  "flags": ["ai_analysis_unavailable", "fallback_triggered"],
  "explanation": "AI risk analysis is unavailable due to provider error, timeout, or malformed output. Deferring strictly to the deterministic Policy Engine.",
  "evidence": ["error_type:TimeoutError"],
  "analysis_available": false,
  "model_used": null,
  "latency_ms": 5005
}
```

`RiskAnalysisResponse` always includes the fields shown above. `risk_score` is
bounded to 0–100; `risk_level` is `low`, `medium`, `high`, `critical`, or `unknown`.
The fallback's fixed score 50 is an unavailable-analysis sentinel, not a measured
risk or permission to execute. Other failures report their exception type only,
for example `error_type:ValidationError` for malformed JSON or `error_type:ValueError`
for a missing key. Invalid initial requests raise a clear validation error.

`latency_ms` is an optional integer for backward-compatible construction of
responses. Both service functions populate it using `time.perf_counter()` on
success and fallback, including request preparation and owned-client cleanup.
It is local elapsed time, not a Gemini-reported metric; submillisecond executions
may report zero. The example values above are illustrative, not benchmarks.

### Security behavior and limitations

- Input strings are capped at 128 characters for standard fields and 300 for
  metadata values, including nested lists/dictionaries; control/format characters
  are removed. Original requests remain available for deterministic policy checks.
- The sanitizer scans text before truncation and flags obvious injection patterns.
  JSON payload delimiters are escaped and system instructions mark all payload
  content as untrusted. This reduces risk but does not guarantee injection immunity.
- A suspected injection forces `prompt_injection_suspected`, a score of at least
  90, and level `critical` on a successful analysis. Provider failure still returns
  the exact fallback shown above.
- Missing historical fields add `limited_historical_context` and an explicit
  explanation. Zero and `false` are supplied values, not missing context.
- `compute_heuristic_signals` calculates exact decimal comparisons before text
  truncation: amount >= 5 times a positive historical average, amount > a supplied
  policy limit, and token absent from a supplied allowlist (including an empty
  list). These fixed `heuristic:*` signals appear outside the untrusted JSON in
  the prompt as advisory evidence. They never decide policy. Invalid/nonfinite
  numeric inputs skip numeric comparisons; no signal does not mean safe.
- Pydantic validates structured Gemini output. Semantic regex guardrails rewrite
  matched affirmative decision/verification claims with `[Advisory Note]: ` and
  add `output_guardrail_sanitized`. Legitimate negations such as "not approved"
  and "not on-chain verified" are preserved. Matching remains heuristic and
  cannot prove every statement is factual. Amounts are not validated as blockchain
  transactions.
- API keys use `SecretStr`, which masks normal representations but is not encryption.
  Service warning logs contain exception types only. Sanitization is not a general
  secret/PII redactor: the backend must minimize the data sent to the provider.
- Default model: `gemini-2.5-flash`; temperature: `0.1`; JSON output uses
  `response_schema=GeminiStructuredOutput` and is validated again locally.
  Scores are advisory and not calibrated probabilities. Low temperature does not
  guarantee identical responses. Dependency lower bounds are not a lockfile.

### Demo CLI for judges

From the repository root, with dependencies installed, run all four scenarios
without internet or credentials:

```powershell
python ai-engine/demo_cli.py --mock
```

For a live pitch with `GEMINI_API_KEY` in the environment or module `.env`:

```powershell
python ai-engine/demo_cli.py --interactive
```

Default mode is live for scenarios 1–3 and consumes API quota; without a configured
key the CLI explains how to use `--mock` and exits. `--interactive` pauses before
each scenario; omit it to run continuously. Add `--no-color` for plain output.
ANSI colors are green for low, yellow for medium/high, red for critical, and blue
for fallback. Each result shows flags, evidence, explanation, model, and latency.

The scenarios are a routine 40 USDC transfer to `treasury.sentinel.near` (historical
average 50), a 25,000 USDC transfer to `anon-drainer.near` at 18 transactions/hour,
prompt injection targeting a zero score, and a simulated provider timeout. In mock
mode the injected provider returns a misleading zero for the injection scenario,
and the real service guardrail raises it to at least 90. Scenario 4 **always**
injects a timeout, even in live mode, after a short simulated delay. All simulated
results are labeled; their latency does not benchmark Gemini. No transaction or
Policy Engine is executed by the CLI.

### Running tests

From the repository root, the requested POSIX command is:

```bash
PYTHONPATH=ai-engine pytest ai-engine/tests -v
```

PowerShell equivalent:

```powershell
$env:PYTHONPATH = "ai-engine"
python -m pytest ai-engine/tests -v
```

With dependencies installed, from `ai-engine/`, run all offline tests explicitly:

```powershell
python -m pytest tests -q -k "not live_gemini" -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

To collect the optional live test too:

```powershell
python -m pytest tests -q -rs -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

The live test has
`@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="Requires real GEMINI_API_KEY")`.
It is skipped without a key in the **process environment**. A key only in `.env`
does not enable collection-time execution. If the environment key is present,
the second command makes a real call and consumes quota. To run only that test,
use `python -m pytest tests/test_analyzer.py -v -k live_gemini` after exporting a key.

Latest local result with Python 3.12.15, `google-genai` 2.34.0, and Pydantic 2.14.2:
**171 passed, 1 skipped** (the optional live test). No live provider request was
made. Mocks exercise orchestration, parsing, sanitization, guardrails, timeout,
missing-key and malformed-output fallbacks, log privacy, dotenv discovery and
precedence, async deadlines/cancellation, measured latency, exact heuristic
boundaries, legitimate negations, the CLI, and sync/async client ownership;
they do not measure the accuracy of Gemini's anomaly judgments.

## Español

### Propósito y límites de la IA

El módulo ofrece **análisis consultivo de riesgos** para operaciones de agentes
en NEAR Protocol. Nunca aprueba ni rechaza operaciones, modifica políticas,
reemplaza al Policy Engine determinista ni ejecuta transacciones. El backend y
el Policy Engine conservan las decisiones y los requisitos de firma.

El análisis utiliza únicamente el contexto off-chain enviado por el backend.
No consulta RPC de NEAR ni verifica transacciones, hashes o estados de la red.
Los acuerdos están en [doc_ia.md](../docs/doc_ia.md) y
[api_contract.md](../docs/api_contract.md).

### Instalación y variables de entorno

Desde la raíz del repositorio, con Python 3.12 y PowerShell:

```powershell
cd ai-engine
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

En Linux/macOS utiliza `python3.12 -m venv .venv`, `source .venv/bin/activate` y
`cp .env.example .env`. Reemplaza la clave de ejemplo en `.env`. Las variables son
`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` y `GEMINI_TIMEOUT_SECONDS=5.0`.
La clave es opcional al importar: si falta o está vacía se devuelve el fallback.
El placeholder del ejemplo debe reemplazarse para usar Gemini.

Las variables del proceso tienen prioridad. Se cargan tanto el `.env` del directorio
actual como el `.env` de `ai-engine/`, cuya ruta absoluta se obtiene desde
`config.py`. Si ambos definen una variable, prevalece el archivo del módulo porque
se carga al final. No es necesario cambiar de directorio ni llamar a `load_dotenv`.
En Docker se utiliza `env_file`. No subas `.env` al repositorio; `.env.example`
sí está permitido. Se usa exclusivamente el SDK oficial `google-genai`.
El timeout debe ser positivo y finito: configura el HTTP del SDK y el plazo de
generación asíncrona mediante `asyncio.wait_for`. Al vencer se cancela la llamada
y se devuelve el fallback. La cancelación y el cierre de recursos pueden extender
el tiempo total del endpoint.

### Guía de integración para el Backend Owner

El backend actual solo implementa inicio y health. La
[receta FastAPI completa](#backend-owner-integration-fastapi) muestra el archivo
`backend/app/ai_routes.py` y su registro en `backend/app/main.py`, listos para
copiar. Instala también `../backend/requirements.txt` en el entorno activado.
El import correcto es `from analyzer import analyze_operation`; el bloque ajusta
la ruta tanto para `ai-engine/` local como para `/app/ai_engine` en Docker.
La configuración encuentra automáticamente el `.env` del módulo.

Conecta `app.state.evaluate_policy` a un adaptador síncrono del Policy Engine real.
Debe recibir la operación original y devolver `operation_id`, `decision`, `reason`,
`policy_id`, `requires_signature` y, opcionalmente, `analysis_context`. Este último
debe proceder del almacenamiento de políticas e historial del backend, con
metadatos mínimos y sin secretos. Nunca confíes en límites o promedios enviados
por el cliente HTTP.

Mientras falte el adaptador, el endpoint devuelve `503` sin llamar a Gemini.
El backend debe implementar autenticación, comprobaciones de propiedad,
persistencia y ejecución. La respuesta conserva la decisión determinista y añade
`risk_score` y `ai_analysis`; acuerda esta extensión del contrato antes de integrar
el frontend. La IA nunca sobrescribe las decisiones ni los requisitos de firma.

Se usa `def` para que FastAPI ejecute la llamada síncrona en su pool de hilos.
Para `async def`, la misma sección incluye una función de reemplazo que usa
`await analyze_operation_async(...)` y `await client.aio.models.generate_content(...)`
internamente. Solo el adaptador de políticas síncrono se mueve a un hilo. Ambas
interfaces comparten validación, guardrails y fallbacks; la cancelación asíncrona
se propaga y los clientes inyectados siguen siendo responsabilidad del llamador.
Para iniciar localmente, desde la raíz: `cd backend` y
`python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.

### Integración con Docker Compose

El [bloque de Compose](#docker-compose-integration) añade el volumen requerido
`./ai-engine:/app/ai_engine`, mantiene `./backend:/app`, configura
`env_file: ./ai-engine/.env` e instala las dependencias al iniciar el contenedor.
Combínalo con el servicio existente conservando build, puertos, `DATABASE_URL`
y `depends_on`. Luego ejecuta `docker compose up --build backend` desde la raíz.

Montar el volumen no instala el SDK. El comando propuesto es para desarrollo y
requiere acceso al registro de paquetes al iniciar. Para desplegar, instala las
dependencias durante el build; el contexto actual `./backend` debe cambiar si el
Dockerfile necesita copiar archivos de `ai-engine/`.

### Esquemas de entrada y salida

Los [ejemplos JSON compartidos](#input-and-output-examples) incluyen entradas y
salidas normales y sospechosas, además de la respuesta exacta de fallback por
timeout. Son ilustrativos; no garantizan una respuesta concreta de Gemini.
Las entradas enriquecidas son para `analyze_operation`; el cuerpo HTTP del ejemplo
solo acepta los siete campos principales de la operación. Se recomiendan montos
como strings decimales para conservar precisión.

La respuesta incluye `risk_score` entre 0 y 100, `risk_level`, `flags`,
`explanation`, `evidence`, `analysis_available`, `model_used` y `latency_ms`. Este
último es opcional al construir respuestas y ambas funciones del servicio lo
calculan con `time.perf_counter()` incluso en fallback, incluyendo preparación y
cierre de clientes propios. Puede ser cero si transcurre menos de un milisegundo;
los valores de los ejemplos no son benchmarks. El nivel puede ser
`low`, `medium`, `high`, `critical` o `unknown`. El fallback devuelve puntaje 50,
nivel `unknown`, los flags `ai_analysis_unavailable` y `fallback_triggered`,
`analysis_available=false` y `model_used=null`. El 50 indica análisis no disponible;
no representa un riesgo medido ni un permiso para ejecutar. Un input inicial
inválido lanza un error de validación al llamador.

### Seguridad y limitaciones

La sanitización limita textos a 128 caracteres en campos estándar y 300 en valores
de metadata, elimina caracteres de control/formato y detecta patrones de inyección
antes de truncar. El prompt delimita los datos no confiables y escapa las etiquetas.
En análisis disponibles, una inyección sospechosa fuerza puntaje mínimo 90, nivel
`critical` y el flag `prompt_injection_suspected`. Un fallo del proveedor conserva
el fallback fijo. El contexto histórico ausente se declara explícitamente con
`limited_historical_context`; cero y `false` no se consideran datos ausentes.

Las señales `heuristic:amount_exceeds_5x_historical_avg`,
`heuristic:exceeds_policy_max_amount` y `heuristic:token_not_in_allowlist` se calculan
antes de truncar los textos. Usan comparaciones decimales para evitar errores de
precisión y se envían fuera del JSON no confiable como evidencia consultiva, sin
tomar decisiones. Los datos numéricos inválidos/no finitos no generan señales
numéricas; ausencia de señal no significa seguridad.

Pydantic valida la salida estructurada. El guardrail semántico reescribe las
afirmaciones de decisión o verificación que coincidan con sus patrones, añade
`[Advisory Note]: ` y el flag `output_guardrail_sanitized`, y conserva negaciones
legítimas como "not approved" y "not on-chain verified". No garantiza bloquear
toda inyección ni detectar toda afirmación inventada. La sanitización no es un eliminador general de secretos
o datos personales: el backend debe filtrar lo enviado. `SecretStr` oculta las
representaciones habituales de la clave; no la cifra. Los logs del servicio
registran únicamente el tipo de excepción.

El modelo predeterminado es `gemini-2.5-flash`, con temperatura `0.1` y
`response_schema=GeminiStructuredOutput`. Los puntajes son consultivos y no son
probabilidades calibradas. La temperatura baja no garantiza respuestas idénticas;
las dependencias declaran mínimos, no versiones bloqueadas.

### Demo CLI para jueces

Desde la raíz del repositorio, ejecuta los cuatro escenarios sin internet ni clave:

```powershell
python ai-engine/demo_cli.py --mock
```

Con una clave configurada, el modo predeterminado llama a Gemini para los escenarios
1–3. Para avanzar con Enter durante el pitch:

```powershell
python ai-engine/demo_cli.py --interactive
```

Puedes combinar `--mock --interactive` o usar `--no-color`. La demo muestra una
transferencia normal de 40 USDC a `treasury.sentinel.near`, un drenaje de 25,000 USDC
a `anon-drainer.near` con 18 tx/hora, una inyección que intenta forzar puntaje cero
y un timeout. Verde indica riesgo bajo, amarillo alto/medio, rojo crítico y azul
fallback. Se muestran modelo, disponibilidad, latencia, flags, explicación y evidencia.

El escenario 4 siempre simula el timeout, incluso en modo en vivo. Las salidas
simuladas se identifican explícitamente y su latencia no mide el rendimiento de
Gemini. La CLI no ejecuta transacciones ni un Policy Engine. Sin clave, el modo
en vivo indica cómo usar `--mock` y termina.

### Ejecución de pruebas

Desde la raíz, en PowerShell:

```powershell
$env:PYTHONPATH = "ai-engine"
python -m pytest ai-engine/tests -v
```

En POSIX: `PYTHONPATH=ai-engine pytest ai-engine/tests -v`.

Desde `ai-engine/`, para ejecutar únicamente las pruebas offline:

```powershell
python -m pytest tests -q -k "not live_gemini" -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

Para incluir la prueba opcional en la colección:

```powershell
python -m pytest tests -q -rs -p no:cacheprovider -o asyncio_default_fixture_loop_scope=function
```

La prueba en vivo se omite si `GEMINI_API_KEY` no está en el entorno del proceso;
una clave únicamente en `.env` no la activa. Si la variable está presente, el
segundo comando realiza una llamada real y consume cuota. Para ejecutar solo esa
prueba utiliza `python -m pytest tests/test_analyzer.py -v -k live_gemini`.

Resultado local con Python 3.12.15: **171 passed, 1 skipped**, sin llamadas reales.
Los mocks verifican integración y mecanismos de seguridad; no evalúan la precisión
de las decisiones de riesgo del modelo. La descripción del PR está en
[PR_DESCRIPTION.md](PR_DESCRIPTION.md).
