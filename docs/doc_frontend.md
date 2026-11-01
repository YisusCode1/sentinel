# Assignment — Frontend 1: Dashboard and Policy UI

## Mission
Build the main Sentinel dashboard and policy configuration experience in React + TypeScript + Vite.

## Main responsibilities
- Create the dashboard layout and shared visual system.
- Build reusable UI components (navigation, cards, status indicators, buttons, inputs, tables).
- Build the policy list and policy creation/edit form.
- Represent policy settings such as operation amount limit, allowed tokens/protocols, approved recipients, permissions and frequency.
- Add loading, empty, success and error states.
- Keep the UI responsive and accessible.

## Suggested ownership
Work primarily in `frontend/src/components/` and dashboard/policy page files. Coordinate page names and shared components with Frontend 2 before changing shared files.

## First deliverables
1. Dashboard shell and navigation.
2. Policy overview screen using clearly labeled mock data if the API is not ready.
3. Policy form with client-side validation.
4. Short note describing components, routes and any mock data.

## Integration rules
- Do not invent backend response fields; use `docs/api_contract.md`.
- Keep API calls in a shared service/helper rather than scattering `fetch` calls through components.
- Do not claim a policy is on-chain unless the backend/contract confirms it.
- Use mock data only when clearly identified as demo data.

## Definition of done
- The screen runs with `npm run dev` / Docker.
- TypeScript builds without errors.
- UI handles loading, empty and error states.
- A Pull Request is opened against `main` with screenshots and a short summary.

## En Español

# Asignación — Frontend 1: Panel de Control e Interfaz de Políticas

## Misión

Desarrollar el panel de control principal de Sentinel y la experiencia de configuración de políticas utilizando React + TypeScript + Vite.

## Responsabilidades principales

- Crear la estructura del panel de control y el sistema visual compartido.
- Desarrollar componentes de interfaz reutilizables (navegación, tarjetas, indicadores de estado, botones, campos de entrada y tablas).
- Construir el listado de políticas y el formulario para crear y editar políticas.
- Representar las configuraciones de las políticas, tales como:
  - Límite de monto por operación.
  - Tokens y protocolos permitidos.
  - Destinatarios autorizados.
  - Permisos.
  - Frecuencia de las operaciones.
- Incorporar estados de carga, vacío, éxito y error.
- Garantizar que la interfaz sea adaptable a diferentes dispositivos (responsive) y accesible.

## Responsabilidad sobre los archivos

Trabajar principalmente en `frontend/src/components/` y en los archivos correspondientes a las páginas del panel de control y de políticas.

Coordinar los nombres de las páginas y los componentes compartidos con Frontend 2 antes de modificar archivos que ambos equipos utilicen.

## Primeros entregables

1. **Estructura del dashboard y navegación:** desarrollar la estructura principal del panel de control y su sistema de navegación.
2. **Pantalla de resumen de políticas:** utilizar datos simulados (*mock data*) claramente identificados si la API todavía no está disponible.
3. **Formulario de políticas:** implementar un formulario con validaciones del lado del cliente (frontend).
4. **Nota técnica breve:** describir los componentes desarrollados, las rutas de navegación y cualquier dato simulado utilizado.

## Reglas de integración

- No inventar campos en las respuestas del backend; utilizar como referencia el documento `docs/api_contract.md`.
- Centralizar las llamadas a la API en un servicio o función auxiliar compartida, en lugar de distribuir llamadas `fetch` por diferentes componentes.
- No afirmar que una política está registrada o verificada en blockchain (*on-chain*) a menos que el backend o el contrato inteligente lo confirme.
- Utilizar datos simulados únicamente cuando estén claramente identificados como datos de demostración.

## Criterios para considerar el trabajo terminado (Definition of Done)

- La aplicación se ejecuta correctamente mediante `npm run dev` o Docker.
- TypeScript compila sin errores.
- La interfaz gestiona correctamente los estados de carga, vacío y error.
- Se crea un Pull Request (PR) dirigido a la rama `main`, incluyendo capturas de pantalla y un breve resumen de los cambios realizados.
