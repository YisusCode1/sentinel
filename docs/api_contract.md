# API de Sentinel — Operaciones implementadas

Base local: `http://localhost:8001/api/v1`. Esquemas interactivos: `http://localhost:8001/docs`.

## Políticas

- `POST /policies`: crea una política; responde `201` con `id`, `created_at` y los campos enviados.
- `GET /policies`: devuelve un array de políticas existentes.
- `GET /policies/{id}`: obtiene una política; `404` si no existe.

```json
{
  "name": "Transferencias de tesorería",
  "max_amount": "100",
  "allowed_tokens": ["USDC"],
  "allowed_recipients": ["treasury.testnet"],
  "allowed_operations": ["transfer"]
}
```

Nombre e identificadores: 1–256 caracteres, sin espacios exteriores. Cada lista requiere 1–50 entradas no vacías. Las coincidencias son exactas y distinguen mayúsculas. Una lista vacía no significa permitir todo. No se crean políticas automáticamente.

Los montos son **strings decimales positivos**, con hasta 30 dígitos enteros y 24 decimales. No se aceptan exponentes, números JSON, separadores de miles, negativos, cero, NaN ni infinito. El límite se expresa en unidades del token solicitado; no hay conversión entre activos ni cálculo de cotizaciones.

## Evaluar una operación

`POST /operations/evaluate` → `201`. La cabecera opcional `Idempotency-Key` acepta un UUID. El frontend la envía y reutiliza al reintentar un envío sin respuesta. La misma clave y solicitud devuelve la evaluación original; la misma clave con otros datos devuelve `409`.

```json
{
  "agent_id": "sentinel-agent",
  "policy_id": "<id devuelto al crear la política>",
  "network": "near-testnet",
  "operation": "transfer",
  "token": "USDC",
  "amount": "40",
  "recipient": "treasury.testnet"
}
```

La red admitida actualmente es `near-testnet`. Todos los campos son obligatorios. Se rechazan los campos desconocidos (`422`). Una política inexistente devuelve `404`; una solicitud inválida no se registra como operación rechazada.

El motor evalúa monto máximo, token permitido, destinatario autorizado y tipo de operación. La decisión es `approved` solo cuando pasan los cuatro controles; en otro caso es `rejected`. El monto se compara con `Decimal`, sin conversión a coma flotante.

La respuesta contiene todos los campos de la solicitud y:

| Campo | Significado |
| --- | --- |
| `operation_id` | Identificador generado en el servidor |
| `created_at` | Fecha ISO 8601 en UTC |
| `decision` | `approved` o `rejected`, según la política |
| `reason` | Explicación del resultado |
| `policy_name`, `policy_snapshot` | Nombre y copia de la política evaluada |
| `checks` | Array con `code`, `label`, `passed`, `detail` por control |
| `risk_score` | `null`: no hay analizador IA implementado |
| `risk_analysis_status` | `unavailable` |
| `requires_signature` | `null`: firma no implementada |
| `verification_status` | `not_performed` |
| `execution_status` | `not_submitted` |

Tanto las evaluaciones aprobadas como rechazadas se guardan antes de responder.

## Historial y detalle

`GET /operations` admite:

- `q`: búsqueda literal sin distinción de mayúsculas, hasta 256 caracteres; busca ID, agente, política, red, tipo, token, monto y destinatario.
- `decision`: `approved` o `rejected`; omitir para ambas.
- `date_from`, `date_to`: fechas `YYYY-MM-DD`, inclusivas y en UTC.
- `page`: desde 1; predeterminado 1.
- `page_size`: 1–100; predeterminado 10.

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 10,
  "summary": { "total": 0, "approved": 0, "rejected": 0 }
}
```

`items` contiene evaluaciones completas, más recientes primero. `summary` y `total` consideran todos los registros que cumplen los filtros, antes de paginar. Las fechas inválidas, rangos invertidos y parámetros fuera de rango devuelven `422`.

`GET /operations/{operation_id}` devuelve una evaluación completa o `404`.

## Persistencia y ejecución local

Se utiliza SQLAlchemy. Con `DATABASE_URL`, se conecta al PostgreSQL configurado en Docker Compose. Sin esa variable, usa SQLite persistente en `backend/data/sentinel.db` (ignorado por Git). Las tablas iniciales se crean al arrancar. No hay datos simulados ni precarga en la sección Operaciones.

CORS admite los orígenes locales de Vite en puertos 5173 y 5174, tanto `localhost` como `127.0.0.1`. `CORS_ORIGINS` permite configurar una lista de orígenes separados por comas. El frontend acepta `VITE_API_BASE_URL` (ver `frontend/.env.example`).

Este servicio es un prototipo local sin autenticación ni separación entre usuarios. El flujo implementado **evalúa y registra**, no envía transacciones, firma autorizaciones, consulta Gemini ni verifica contratos en NEAR. Aprobar una política no equivale a certificar seguridad ni a bloquear una billetera externa. No se implementan aún límites de frecuencia, conversión monetaria ni ejecución on-chain.

Las pruebas automatizadas del repositorio cubren SQLite. PostgreSQL utiliza la configuración existente de Compose y debe verificarse en ese entorno al desplegar.
