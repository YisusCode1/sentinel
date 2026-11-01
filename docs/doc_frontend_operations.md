# Assignment — Frontend 2: Operations, History, Alerts and Demo

## Mission
Build the Sentinel operations experience and prepare the demo flow. This role also owns the English pitch and demo/video coordination.

## Main responsibilities
- Create the operation evaluation screen/form.
- Show the proposed operation details and Sentinel decision: approved/rejected or the agreed status.
- Show the decision reason, risk analysis, policy reference and signature/verification status when available.
- Build operation history and alert views.
- Create a clear demo scenario: one operation within policy limits and one that exceeds a limit.
- Prepare the English pitch and coordinate a short demo/video.

## Suggested ownership
Work primarily in operation/history/alert page files and related components. Coordinate shared layout, navigation and styling with Frontend 1. Avoid simultaneous edits to the same shared files.

## First deliverables
1. Operation submission/evaluation screen using the API contract.
2. Results panel for decision and reason.
3. History/alerts view with clearly marked mock data if needed.
4. Demo script and pitch outline in English.

## Integration rules
- Follow `docs/api_contract.md`; coordinate schema changes with the backend owner.
- Do not label an operation “on-chain verified” unless verification is actually implemented and confirmed.
- Do not imply that a backend decision alone blocks a wallet transaction.
- Separate demo/mock records from real API data.

## Definition of done
- Main flow can be demonstrated from submission to displayed decision.
- Error and pending states are represented.
- Demo includes one accepted-by-policy case and one rejected-by-policy case.
- Pull Request includes screenshots and demo notes.

## En Español

# Asignación — Frontend 2: Operaciones, Historial, Alertas y Demostración

## Misión

Desarrollar la experiencia de operaciones de Sentinel y preparar el flujo de demostración del proyecto. Este rol también es responsable de preparar el discurso de presentación (pitch) en inglés y coordinar la demostración o el video.

## Responsabilidades principales

- Crear la pantalla o formulario para evaluar operaciones.
- Mostrar los detalles de la operación propuesta y la decisión de Sentinel: aprobada, rechazada o el estado que se acuerde.
- Mostrar el motivo de la decisión, el análisis de riesgo, la referencia de la política y el estado de firma/verificación, cuando estén disponibles.
- Desarrollar las vistas del historial de operaciones y de alertas.
- Crear un escenario de demostración claro: una operación que esté dentro de los límites de la política y otra que supere alguno de esos límites.
- Preparar el pitch en inglés y coordinar una demostración o video breve.

## Responsabilidad sobre los archivos

Trabajar principalmente en los archivos de las páginas de operaciones, historial y alertas, así como en sus componentes relacionados.

Coordinar el diseño general, la navegación y los estilos compartidos con Frontend 1.

Evitar editar simultáneamente los mismos archivos compartidos para prevenir conflictos.

## Primeros entregables

1. **Pantalla de envío y evaluación de operaciones:** debe utilizar el contrato de API.
2. **Panel de resultados:** debe mostrar la decisión de Sentinel y el motivo correspondiente.
3. **Vista de historial y alertas:** debe incluir datos simulados (*mock data*) claramente identificados, si fuera necesario.
4. **Guion de demostración y esquema del pitch:** ambos deben estar preparados en inglés.

## Reglas de integración

- Seguir el documento `docs/api_contract.md` y coordinar cualquier modificación del esquema con el responsable del backend.
- No etiquetar una operación como «Verificada en blockchain» (*on-chain verified*) a menos que la verificación esté realmente implementada y confirmada.
- No dar a entender que una decisión del backend, por sí sola, bloquea una transacción en una billetera externa.
- Diferenciar claramente los registros de demostración o simulados de los datos provenientes de la API real.

## Criterios para considerar el trabajo terminado (Definition of Done)

- El flujo principal puede demostrarse desde el envío de una operación hasta la visualización de la decisión.
- Los estados de error y pendiente están representados.
- La demostración incluye un caso aceptado según la política y otro rechazado según la política.
- El Pull Request (PR) incluye capturas de pantalla y notas sobre la demostración.