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
## Implemented AI integration

This section supersedes the draft operation examples above.
All backend policy and operation endpoints require `X-API-Key`, except
`GET /` and `GET /api/v1/health`. The backend derives the agent identity from
the key. Supplying `agent_id` or any other unknown field in a request is
rejected with 422. There is no public agent-registration API; agents and their
keys are created with the administrative script:

```bash
docker compose exec backend python -m app.scripts.create_agent --name <agent-name> [--demo-policy]
```

The API key is printed once; only its hash is stored.

- `POST /api/v1/policies`: `name`, `max_amount` (decimal string),
  `allowed_tokens`, `allowed_recipients`, `allowed_operations`.
- `GET /api/v1/policies`: policies of the authenticated agent.
- `GET /api/v1/policies/{policy_id}`: one policy (404 if missing or owned by
  another agent).
- `POST /api/v1/operations/evaluate`: `policy_id`, `network`, `operation`, `token`,
  `amount` (decimal string), `recipient`. Response: `operation_id`, `decision`
  (`approved|rejected`), `reason`, `policy_id`, `ai_analysis`.
- `GET /api/v1/operations`: list of the agent's operations. Query: `decision`
  (`approved|rejected`) and `limit` (1-200, default 50). Each record includes
  the persisted `ai_analysis` (null for rejected and older records).
- `GET /api/v1/operations/{operation_id}`: one operation (404 if missing or
  owned by another agent).

Amounts are serialized as strings (for example `"10.00000000"`).

The deterministic Policy Engine is the only authority that approves or rejects
an operation. Gemini only analyzes operations that the Policy Engine already
approved, and its output is advisory. `ai_analysis` contains `risk_score`
(0-100), `risk_level` (`low|medium|high|critical|unknown`), `flags`,
`explanation`, `evidence`, `analysis_available`, `model_used` and `latency_ms`.

If the AI provider fails or times out, the operation is still evaluated and
stored: `ai_analysis` has `analysis_available=false`, `risk_level=unknown`
and the flags `ai_analysis_unavailable` and `fallback_triggered`. In that case
`risk_score` is a placeholder and must not be displayed as a real risk.

The internal AI Engine (`POST /analyze`) requires the `X-Internal-Service-Key`
header; it is not exposed to agents.

Errors: 401 invalid, missing, inactive or expired API key; 404 policy or
operation not found (or owned by another agent); 422 malformed payload.

No transaction execution, signature or on-chain verification is implemented by
these endpoints.
