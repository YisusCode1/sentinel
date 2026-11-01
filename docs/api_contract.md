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