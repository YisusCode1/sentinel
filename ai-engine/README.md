# Sentinel AI Engine

FastAPI expone la lógica canónica de `analyzer/`:

- `POST /analyze`: análisis consultivo, sanitización y validación de salida.
- `POST /assistant/chat`: chat de solo lectura con contexto aportado por backend.
- `GET /health`: configuración del servicio, modo y disponibilidad del fallback;
  no realiza una llamada de verificación al proveedor.

Ambos POST requieren `X-Internal-Service-Key`. La identidad del agente se resuelve
en el backend, no en este servicio interno. Gemini se configura con
`GEMINI_API_KEY` (o `LLM_API_KEY` como alias), `GEMINI_MODEL` y
`GEMINI_TIMEOUT_SECONDS`. Sin proveedor disponible, `AI_DEMO_FALLBACK=true`
activa una demo determinista explícitamente identificada.

Los módulos de `app/` son adaptadores/imports de compatibilidad; los prompts,
modelos, sanitizador y cliente LLM viven en `analyzer/`. La IA nunca cambia reglas,
aprueba operaciones ni ejecuta transacciones.

Consulta [la guía completa](../docs/ai_assistant.md) para Docker, ejecución local,
contratos, demo y pruebas. El contrato HTTP está en
[api_contract.md](../docs/api_contract.md).
