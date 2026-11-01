# Assignment — AI: Gemini Risk Analyzer

## Mission
Build an AI analysis component that identifies suspicious patterns or anomalies in a proposed agent operation and returns structured, explainable output.

## Main responsibilities
- Implement Gemini integration in `ai-engine/`.
- Define the input/output schema for risk analysis.
- Design prompts that analyze operation context without approving operations.
- Return structured JSON with risk score, flags, explanation and relevant evidence.
- Add fallback behavior for timeout, malformed output or provider failure.
- Create test cases for normal and suspicious operations.

## AI boundary
The AI component is advisory. It must **not**:
- approve or reject an operation on its own;
- modify a user's policy;
- bypass the deterministic Policy Engine;
- invent blockchain verification or transaction status.

The deterministic Policy Engine owns policy decisions. Backend orchestration combines the policy result and AI risk information according to the agreed rules.

## Suggested output shape
Coordinate the final schema with the backend owner. Initial example:

```json
{
  "risk_score": 72,
  "risk_level": "high",
  "flags": ["unusual_amount", "new_recipient"],
  "explanation": "The amount is unusual for this agent and the recipient has not been seen before."
}
```

## First deliverables
1. Risk-analysis module and configuration through environment variables.
2. Typed request/response schema.
3. Prompt and output validation.
4. Tests for ordinary, anomalous and failure cases.
5. README for setup and API/function usage inside `ai-engine/`.

## Security and privacy
- Never commit Gemini API keys.
- Do not log secrets or unnecessary personal data.
- Treat operation fields as untrusted input.
- Make uncertainty and unavailable analysis explicit.

## Definition of done
- Analyzer returns schema-valid output or a controlled error.
- Tests cover expected and failure cases.
- Backend owner can call the module through a documented interface.
- Pull Request describes model behavior, limitations and test results.

## En Español

# Asignación — IA: Analizador de Riesgos con Gemini

## Misión

Desarrollar un componente de análisis mediante inteligencia artificial que identifique patrones sospechosos o anomalías en las operaciones propuestas por un agente y devuelva resultados estructurados y explicables.

## Responsabilidades principales

- Implementar la integración con Gemini dentro del directorio `ai-engine/`.
- Definir el esquema de entrada y salida para el análisis de riesgos.
- Diseñar instrucciones (*prompts*) que permitan analizar el contexto de las operaciones sin aprobarlas.
- Devolver respuestas en formato JSON estructurado que incluyan:
  - Puntaje de riesgo (*risk score*).
  - Indicadores de alerta (*flags*).
  - Explicación del análisis.
  - Evidencias relevantes.
- Implementar mecanismos alternativos de respuesta (*fallback*) ante tiempos de espera agotados, respuestas malformadas o fallos del proveedor.
- Crear casos de prueba para operaciones normales y sospechosas.

## Límites y responsabilidades de la IA

El componente de inteligencia artificial tiene una función exclusivamente consultiva. **NO debe:**

- Aprobar ni rechazar una operación por cuenta propia.
- Modificar las políticas de un usuario.
- Ignorar ni eludir el Motor Determinista de Políticas (*Policy Engine*).
- Inventar verificaciones en blockchain ni estados de transacciones.

El Motor Determinista de Políticas (*Policy Engine*) es el responsable de tomar las decisiones sobre las políticas.

El backend se encarga de coordinar y combinar el resultado de las políticas con la información de riesgo proporcionada por la IA, de acuerdo con las reglas previamente establecidas.

## Estructura de salida sugerida

Coordinar el esquema definitivo con el responsable del backend.

Ejemplo inicial:

```json
{
  "risk_score": 72,
  "risk_level": "high",
  "flags": ["unusual_amount", "new_recipient"],
  "explanation": "The amount is unusual for this agent and the recipient has not been seen before."
}
```

Traducción del significado de los campos:

- `risk_score`: puntaje de riesgo (72).
- `risk_level`: nivel de riesgo (alto).
- `flags`: indicadores de alerta (monto inusual, nuevo destinatario).
- `explanation`: explicación del análisis realizado.

## Primeros entregables

1. **Módulo de análisis de riesgos:** implementar el módulo y su configuración mediante variables de entorno.
2. **Esquemas tipados de solicitud y respuesta:** definir la estructura y los tipos de datos de entrada y salida.
3. **Instrucciones y validación de resultados:** desarrollar los prompts y validar las respuestas generadas por Gemini.
4. **Pruebas:** implementar pruebas para casos normales, anomalías y situaciones de error.
5. **README:** documentar la instalación, configuración y uso de la API o funciones dentro del directorio `ai-engine/`.

## Seguridad y privacidad

- Nunca subir las claves API de Gemini al repositorio.
- No registrar en los logs secretos ni datos personales innecesarios.
- Tratar los campos de las operaciones como entradas no confiables.
- Expresar claramente cualquier incertidumbre o situación en la que el análisis no esté disponible.

## Criterios para considerar el trabajo terminado (Definition of Done)

- El analizador devuelve resultados que cumplen con el esquema definido o genera un error controlado.
- Las pruebas cubren los casos esperados y los escenarios de fallo.
- El responsable del backend puede invocar el módulo mediante una interfaz documentada.
- El Pull Request (PR) describe el comportamiento del modelo, sus limitaciones y los resultados de las pruebas.
