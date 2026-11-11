# Sentinel API Contract — Initial Draft

This document is the shared interface between frontend, backend and AI. Treat it as a draft until endpoints and schemas are implemented and tested. Backend owner coordinates changes.

## Base URL (local)

`http://localhost:8001`

## Health

`GET /api/v1/health`

Example:

```json
{
  "status": "healthy",
  "service": "sentinel-backend"
}
```

## Create policy

`POST /api/v1/policies`

Initial policy fields (final schema to be agreed):

```json
{
  "name": "Demo transfer policy",
  "max_amount": "100",
  "allowed_tokens": ["USDC"],
  "allowed_recipients": ["demo-recipient"],
  "allowed_operations": ["transfer"]
}
```

## Retrieve policy

`GET /api/v1/policies/{id}`

## Evaluate operation

`POST /api/v1/operations/evaluate`

Request example:

```json
{
  "agent_id": "sentinel-demo-agent",
  "policy_id": "policy-001",
  "network": "near-testnet",
  "operation": "transfer",
  "token": "USDC",
  "amount": "40",
  "recipient": "demo-recipient"
}
```

Response example:

```json
{
  "operation_id": "op-001",
  "decision": "rejected",
  "reason": "Amount exceeds policy limit",
  "policy_id": "policy-001",
  "risk_score": 85,
  "requires_signature": false
}
```

These are examples, not guarantees of current implementation. Align naming, enum values, optional fields, error responses and signature semantics before frontend integration.

## List operations

`GET /api/v1/operations`

## Security semantics

- The Policy Engine makes deterministic policy decisions.
- AI risk analysis is advisory and cannot approve or change policy.
- A backend response alone does not enforce a transaction on an external wallet.
- Any verifiable authorization must be bound to operation details and checked by the component controlling execution.
- Never display “on-chain verified” unless the relevant verification has actually occurred.

### En Español

# Contrato de API de Sentinel — Borrador inicial

Este documento define la interfaz compartida entre el frontend, el backend y la inteligencia artificial (IA). Debe considerarse un borrador hasta que los endpoints y los esquemas estén implementados y hayan sido probados. El responsable del backend coordinará los cambios.

## URL base (entorno local)

`http://localhost:8001`

## Estado del servicio (Health)

`GET /api/v1/health`

Ejemplo de respuesta:

```json
{
  "status": "healthy",
  "service": "sentinel-backend"
}
```

## Crear una política

`POST /api/v1/policies`

Campos iniciales de la política (el esquema definitivo está pendiente de aprobación):

```json
{
  "name": "Demo transfer policy",
  "max_amount": "100",
  "allowed_tokens": ["USDC"],
  "allowed_recipients": ["demo-recipient"],
  "allowed_operations": ["transfer"]
}
```

## Obtener una política

`GET /api/v1/policies/{id}`

Permite recuperar una política específica mediante su identificador (`id`).

## Evaluar una operación

`POST /api/v1/operations/evaluate`

Ejemplo de solicitud:

```json
{
  "agent_id": "sentinel-demo-agent",
  "policy_id": "policy-001",
  "network": "near-testnet",
  "operation": "transfer",
  "token": "USDC",
  "amount": "40",
  "recipient": "demo-recipient"
}
```

Ejemplo de respuesta:

```json
{
  "operation_id": "op-001",
  "decision": "rejected",
  "reason": "Amount exceeds policy limit",
  "policy_id": "policy-001",
  "risk_score": 85,
  "requires_signature": false
}
```

Estos ejemplos son ilustrativos y no garantizan que la implementación actual funcione exactamente de esta manera.

Antes de integrar el frontend, se deben definir y unificar los nombres de los campos, los valores permitidos de los enumerados (enum), los campos opcionales, las respuestas de error y la lógica relacionada con las firmas.

## Listar operaciones

`GET /api/v1/operations`

Permite obtener el listado de operaciones registradas.

## Consideraciones de seguridad

- **Motor de políticas (Policy Engine):** toma decisiones deterministas basadas en las políticas configuradas.
- **Análisis de riesgo mediante IA:** tiene carácter consultivo y no puede aprobar operaciones ni modificar las decisiones del motor de políticas.
- **Ejecución de transacciones:** una respuesta del backend, por sí sola, no garantiza ni ejecuta una transacción en una billetera externa.
- **Autorización verificable:** cualquier autorización que pueda verificarse debe estar vinculada a los detalles específicos de la operación y ser validada por el componente que controla su ejecución.
- **Verificación en blockchain (On-chain):** nunca se debe mostrar el mensaje «Verificado en blockchain» (on-chain verified) a menos que la verificación correspondiente se haya realizado realmente.
## Implemented AI integration (2026-11-11)

This section supersedes the draft operation examples above.
All backend policy, operation and assistant endpoints require `X-API-Key`.
The backend derives agent identity from the key. Supplying `agent_id` in an
operation request is rejected (422). There is no public agent-registration API;
use the administrative CLI.

- `GET /api/v1/policies`: up to 200 policies of the authenticated agent.
- `POST /api/v1/operations/evaluate`: `policy_id`, `network`, `operation`, `token`,
  `amount` (decimal string), `recipient`. Response: `operation_id`, `decision`
  (`approved|rejected`), `reason`, `policy_id`, `ai_analysis`.
- `GET /api/v1/operations`: records include persisted `ai_analysis` (nullable for
  older records). Deterministic decisions are independent of the AI score.
- `POST /api/v1/assistant/chat`: `{ "message": "Explica esta operación",
  "operation_id": "optional-owned-operation-id", "history": [] }`.
  History has at most 12 `{role: "user"|"assistant", content: string}` messages.
  Message/content limits: 2000 characters. No client-supplied context is accepted.
  Backend adds up to 20 recent operations, 20 active policies, selected operation
  and the authenticated agent. Other agents and credentials are never included.
  Response: `{reply, suggested_rules: string[], mode: "llm"|"demo"|"unavailable",
  model_used: string|null, warnings: string[]}`. Suggestions are never applied.

`ai_analysis` contains `risk_score` (0–100), `risk_level`
(`low|medium|high|critical|unknown`), `flags`, `explanation`, `evidence`,
`analysis_available`, `model_used`, `latency_ms`. Demo heuristics set
`analysis_available=false`, `model_used=deterministic-demo-v1` and flag
`deterministic_demo`. Input/output sanitization warnings are exposed as flags.
No `requires_signature`, transaction execution or blockchain verification is
implemented by these endpoints.

Internal engine: `POST /analyze`, `POST /assistant/chat` require
`X-Internal-Service-Key`. Missing server key: 503; invalid caller key: 401.
`GET /health` reports configuration without validating the key against Gemini.
Backend invalid credentials: 401; unowned/missing policy or selected operation:
404; malformed payload: 422. Engine context exceeding 100 KB: 413.
Provider/service failure produces an explicit demo or unavailable response and
never overrides the deterministic decision.

See [AI assistant runbook](ai_assistant.md) for exact startup and test commands.
