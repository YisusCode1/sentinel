# Assignment — Backend + NEAR: API, Policy Engine and Verification

## Mission
Own the FastAPI backend, deterministic Policy Engine, data/API integration and NEAR Rust contract work.

## Main responsibilities
- Maintain FastAPI application structure, Pydantic schemas and API routes.
- Implement policy creation/retrieval and deterministic evaluation.
- Define the shared operation and policy schemas in `docs/api_contract.md`.
- Persist policies and operation records in PostgreSQL.
- Integrate the AI Analyzer as an advisory service.
- Develop the NEAR contract component in `contracts/near/`.
- Coordinate integration, reviews and deployment readiness.

## Deterministic Policy Engine
The engine should evaluate explicit policy conditions such as:
- maximum amount per operation;
- allowed token/protocol;
- recipient allowlist;
- permitted operation types;
- frequency/rate limits.

Return a consistent decision and reason. AI output may add risk context but must not override a policy rejection.

## NEAR security boundary
Define precisely what the NEAR contract stores or verifies. A policy record on NEAR is not automatically an enforcement mechanism for a separate wallet or chain.

For any authorization design, bind the authorization to the exact operation fields (at minimum operation type, token, amount, recipient, agent/policy reference and expiry/nonce as appropriate). The execution component must verify it. Document what is actually enforced versus what is only recorded in the demo.

## Initial endpoints
- `POST /api/v1/policies`
- `GET /api/v1/policies/{id}`
- `POST /api/v1/operations/evaluate`
- `GET /api/v1/operations`
- `GET /api/v1/health`

## First deliverables
1. Pydantic schemas and API routes.
2. Deterministic policy evaluation service and unit tests.
3. PostgreSQL persistence for policies and operation history.
4. AI service interface and controlled fallback.
5. NEAR contract prototype, tests and deployment notes.
6. API docs kept aligned with `docs/api_contract.md`.

## Definition of done
- Policy outcomes are deterministic and tested.
- Invalid requests return useful validation errors.
- Operation results are recorded consistently.
- Security claims match the actual enforcement boundary.
- Pull Requests are reviewed and the demo path is documented.

## En Español
# Asignación — Backend + NEAR: API, Motor de Políticas y Verificación

## Misión

Ser responsable del desarrollo del backend con FastAPI, el Motor Determinista de Políticas (*Policy Engine*), la integración de datos y API, y el desarrollo de contratos inteligentes en Rust para NEAR.

## Responsabilidades principales

- Mantener la estructura de la aplicación FastAPI, los esquemas Pydantic y las rutas de la API.
- Implementar la creación, recuperación y evaluación determinista de políticas.
- Definir los esquemas compartidos de operaciones y políticas en `docs/api_contract.md`.
- Almacenar las políticas y los registros de operaciones en PostgreSQL.
- Integrar el Analizador de IA como un servicio de carácter consultivo.
- Desarrollar el componente de contrato inteligente para NEAR dentro de `contracts/near/`.
- Coordinar la integración, las revisiones de código y la preparación para el despliegue.

## Motor Determinista de Políticas (Policy Engine)

El motor debe evaluar condiciones explícitas de las políticas, tales como:

- Monto máximo permitido por operación.
- Tokens o protocolos autorizados.
- Lista de destinatarios permitidos (*allowlist*).
- Tipos de operaciones autorizadas.
- Límites de frecuencia o cantidad de operaciones (*rate limits*).

El motor debe devolver una decisión y un motivo coherentes y consistentes.

La información de riesgo proporcionada por la IA puede complementar el contexto de evaluación, pero nunca debe modificar ni anular el rechazo de una operación determinado por las políticas.

## Límites de seguridad de NEAR

Definir con precisión qué información almacena o verifica el contrato inteligente de NEAR.

El hecho de registrar una política en NEAR no significa automáticamente que exista un mecanismo de cumplimiento o control sobre una billetera externa o sobre otra blockchain.

Para cualquier diseño de autorización, esta debe estar vinculada a los datos exactos de la operación, como mínimo:

- Tipo de operación.
- Token.
- Monto.
- Destinatario.
- Referencia del agente y de la política.
- Fecha de expiración o nonce (número único de uso), según corresponda.

El componente encargado de ejecutar la operación debe verificar dicha autorización.

Documentar claramente qué aspectos están realmente protegidos y ejecutados mediante mecanismos de seguridad y cuáles únicamente se registran o simulan durante la demostración.

## Endpoints iniciales de la API

- `POST /api/v1/policies` — Crear una política.
- `GET /api/v1/policies/{id}` — Obtener una política por su identificador.
- `POST /api/v1/operations/evaluate` — Evaluar una operación.
- `GET /api/v1/operations` — Consultar el historial de operaciones.
- `GET /api/v1/health` — Verificar el estado del servicio.

## Primeros entregables

1. **Esquemas Pydantic y rutas de la API:** definir los modelos de datos y desarrollar los endpoints correspondientes.
2. **Servicio de evaluación determinista de políticas:** implementar el motor de evaluación y sus pruebas unitarias.
3. **Persistencia en PostgreSQL:** implementar el almacenamiento de políticas y el historial de operaciones.
4. **Interfaz del servicio de IA y mecanismo alternativo:** integrar el Analizador de IA y establecer un comportamiento controlado ante fallos.
5. **Prototipo de contrato inteligente para NEAR:** desarrollar el contrato, sus pruebas y las instrucciones para su despliegue.
6. **Documentación de la API:** mantener la documentación actualizada y alineada con `docs/api_contract.md`.

## Criterios para considerar el trabajo terminado (Definition of Done)

- Las decisiones del motor de políticas son deterministas y están respaldadas por pruebas.
- Las solicitudes inválidas devuelven mensajes de error útiles que permiten identificar los problemas de validación.
- Los resultados de las operaciones se registran de manera consistente.
- Las afirmaciones relacionadas con la seguridad corresponden exactamente con los mecanismos de protección realmente implementados.
- Los Pull Requests (PR) son revisados y el flujo de demostración está documentado.