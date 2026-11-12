# Sentinel AI

[🇬🇧 Read in English](README.md)

# Sentinel

**Seguridad y defensa de agentes mediante IA**

Sentinel es un backend de seguridad diseñado para proteger agentes de IA y sistemas automatizados frente a operaciones no autorizadas o riesgosas. Combina autenticación de agentes, políticas de seguridad aisladas, aplicación determinista de reglas y análisis de riesgo asistido por IA para proporcionar una capa adicional de protección antes de procesar operaciones.

Desarrollado para el **NEAR Hackathon 2026**, dentro del track **AI Security & Defense**.

## El problema

Los agentes de IA tienen cada vez más capacidades para interactuar con APIs, servicios financieros e infraestructura blockchain. Sin embargo, permitirles acceder a operaciones sensibles sin controles adecuados introduce riesgos como:

- Transferencias u operaciones no autorizadas.
- Gastos excesivos e incumplimiento de políticas.
- Acceso a recursos pertenecientes a otros agentes.
- Prompt injection y metadatos maliciosos en las operaciones.
- Falta de visibilidad sobre la actividad y los riesgos de los agentes.

Sentinel aborda estos desafíos mediante una capa de seguridad entre los agentes y las operaciones que solicitan.

## Cómo funciona Sentinel

Sentinel combina reglas de seguridad deterministas con análisis de riesgo consultivo mediante IA.

1. **Autenticación de agentes:** cada agente se autentica utilizando su propia API key.
2. **Aislamiento de políticas:** cada agente solo puede acceder a las políticas que le pertenecen.
3. **Policy Engine determinista:** las operaciones se evalúan según políticas activas, límites de gasto, tokens permitidos, destinatarios y tipos de operación.
4. **Análisis de riesgo con IA:** las operaciones aprobadas por el Policy Engine se envían al AI Engine para un análisis adicional.
5. **Persistencia y auditoría:** el backend almacena los datos de la operación y la decisión determinista. El registro de la operación también persiste el análisis consultivo de Gemini (`ai_analysis`); si el proveedor no está disponible, guarda un fallback `unknown`.

El AI Engine tiene únicamente una función consultiva. No puede aprobar, rechazar, autorizar ni ejecutar operaciones. El Policy Engine determinista sigue siendo la única autoridad para tomar decisiones sobre las políticas.

## Arquitectura

```text
                    Agente de IA
                         |
                         | X-API-Key
                         v
                +-------------------+
                |   Sentinel API    |
                |      FastAPI      |
                +-------------------+
                         |
                         v
                +-------------------+
                | Autenticación     |
                | Aislamiento       |
                | de agentes       |
                +-------------------+
                         |
                         v
                +-------------------+
                | Policy Engine     |
                | Determinista      |
                +-------------------+
                         |
                  +------+------+
                  |             |
               RECHAZADA     APROBADA
                  |             |
                  |             v
                  |     +-------------------+
                  |     | AI Engine         |
                  |     | Análisis Gemini   |
                  |     +-------------------+
                  |             |
                  +------+------+
                         |
                         v
                +-------------------+
                | PostgreSQL        |
                | Registro de       |
                | operaciones       |
                +-------------------+
                         |
                         v
                  Respuesta API
```

El AI Engine se ejecuta como un servicio independiente de la aplicación Docker Compose. La comunicación entre el backend y el AI Engine está protegida mediante una clave interna compartida.

## Tecnologías

| Componente | Tecnologías |
|---|---|
| Backend API | Python, FastAPI, Pydantic |
| Policy Engine | Python, evaluación determinista de reglas |
| AI Engine | Python, FastAPI, Google Gemini |
| Modelo de IA | Gemini 2.5 Flash |
| Base de datos | PostgreSQL |
| ORM y migraciones | SQLAlchemy, Alembic |
| Comunicación HTTP | HTTPX |
| Frontend | React, TypeScript, Vite |
| Infraestructura | Docker, Docker Compose |

## Estructura del proyecto

```text
sentinel-ai/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── agent_service.py
│   │   │   ├── ai_client.py
│   │   │   └── policy_engine.py
│   │   ├── cli.py
│   │   ├── main.py
│   │   └── models.py
│   └── requirements.txt
│
├── ai-engine/
│   ├── analyzer/
│   │   ├── config.py
│   │   ├── prompts.py
│   │   ├── sanitizer.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── app/
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   └── src/
│
├── docker-compose.yml
├── README.md
└── README.es.md
```

## Instalación

### Requisitos

- Docker y Docker Compose.
- Python 3.12 o superior para ejecutar los servicios Python localmente.
- Node.js y npm para el desarrollo del frontend.
- Una API key de Google Gemini para realizar análisis reales con IA.

### 1. Clonar el repositorio

```bash
git clone https://github.com/YisusCode1/sentinel.git
cd sentinel
```

### 2. Configurar las variables de entorno

Crear el archivo de entorno de la raíz, utilizado por Docker Compose:

```bash
cp .env.example .env
```

Crear el archivo de entorno del AI Engine:

```bash
cp ai-engine/.env.example ai-engine/.env
```

Crear el archivo de entorno del frontend:

```bash
cp frontend/.env.example frontend/.env
```

Configura las siguientes variables con tus propios valores:

**Backend**

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `INTERNAL_SERVICE_KEY`: clave secreta compartida con el AI Engine.
- `AI_ENGINE_URL`: URL base del AI Engine. En la configuración proporcionada de Docker Compose, su valor predeterminado es `http://host.docker.internal:8002`.

**AI Engine**

- `GEMINI_API_KEY`: API key de Google Gemini. Es necesaria para el análisis real con Gemini, pero no para iniciar el servicio.
- `GEMINI_MODEL`: nombre del modelo. Por defecto, `gemini-2.5-flash`.
- `GEMINI_TIMEOUT_SECONDS`: tiempo máximo de espera de la solicitud a Gemini.
- `INTERNAL_SERVICE_KEY`: debe coincidir con la clave interna configurada en el backend.

**Frontend**

- `VITE_API_BASE_URL`: URL del backend. El archivo de ejemplo utiliza `http://localhost:8001`.

No subas archivos `.env` ni expongas claves API en el control de versiones.

### 3. Iniciar PostgreSQL y el backend

```bash
docker compose up -d --build db backend
```

Ejecutar las migraciones de la base de datos:

```bash
docker compose exec backend alembic upgrade head
```

### 4. Iniciar el AI Engine

En la configuración de desarrollo proporcionada, el AI Engine se ejecuta de forma independiente de Docker Compose.

Desde la raíz del proyecto:

```bash
cd ai-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

En Windows PowerShell, activa el entorno virtual con:

```powershell
.venv\Scripts\Activate.ps1
```

Asegúrate de que el backend y el AI Engine utilicen el mismo valor de `INTERNAL_SERVICE_KEY`.

Sin una `GEMINI_API_KEY` válida, el servicio puede iniciarse, pero el análisis con Gemini no estará disponible y el backend recibirá una respuesta de fallback.

### 5. Iniciar el frontend

En otra terminal:

```bash
docker compose up -d --build frontend
```

También puedes ejecutarlo localmente:

```bash
cd frontend
npm install
npm run dev
```

El frontend de desarrollo estará disponible en:

```text
http://localhost:5174
```

La API del backend estará disponible en:

```text
http://localhost:8001
```

## Administración de agentes

Los agentes se crean y administran mediante la CLI del backend. No existe un endpoint público para crear agentes.

Ejecuta los siguientes comandos desde la raíz del proyecto:

```bash
# Crear un agente
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent create --name "Demo Agent"

# Listar agentes
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent list

# Rotar la API key de un agente
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent key rotate AGENT_ID

# Revocar una API key
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent key revoke KEY_ID
```

**Consideraciones de seguridad:**

- Cada agente tiene sus propias API keys.
- En la base de datos solo se almacenan hashes de las API keys.
- La API key completa se muestra al crearla o rotarla. Guárdala de forma segura porque no puede recuperarse posteriormente.
- Rotar una clave desactiva las claves anteriores que estaban activas para ese agente.
- Las claves revocadas ya no pueden autenticar solicitudes.
- Las operaciones administrativas que modifican el estado en producción requieren el indicador explícito `--confirm-production` y `SENTINEL_ENV=production`.

En producción, el indicador global debe colocarse antes del comando:

```bash
docker compose exec -e SENTINEL_ENV=production backend \
  python -m app.cli --confirm-production agent create --name "Production Agent"
```

## Endpoints de la API

Todos los endpoints protegidos para agentes requieren el encabezado `X-API-Key`.

| Método | Endpoint | Autenticación | Descripción |
|---|---|---|---|
| GET | `/` | Pública | Raíz de la API |
| GET | `/api/v1/health` | Pública | Estado del backend |
| POST | `/api/v1/policies` | API key de agente | Crear una política para el agente autenticado |
| GET | `/api/v1/policies/{policy_id}` | API key de agente | Consultar una política perteneciente al agente |
| POST | `/api/v1/operations/evaluate` | API key de agente | Evaluar una operación según su política |
| GET | `/api/v1/operations` | API key de agente | Consultar las operaciones del agente autenticado |

El AI Engine expone:

| Método | Endpoint | Autenticación | Descripción |
|---|---|---|---|
| GET | `/health` | Pública | Estado y configuración del AI Engine |
| POST | `/analyze` | Clave interna | Análisis consultivo de riesgo mediante IA |

El endpoint `/analyze` del AI Engine requiere el encabezado `X-Internal-Service-Key`.

## Modelo de seguridad

### Autenticación de agentes

Cada agente dispone de su propia API key. El backend valida la clave, comprueba su estado y expiración, e identifica al agente asociado.

El backend no confía en una identidad de agente enviada por el cliente dentro del payload de una operación.

### Aislamiento de políticas

Las políticas pertenecen a agentes individuales. Antes de evaluar una operación, el backend verifica que la política pertenezca al agente autenticado. Esto evita que un agente acceda a las políticas de otro.

### Aplicación determinista de políticas

El Policy Engine evalúa:

- Si la política está activa.
- El importe máximo permitido por operación.
- Los tokens permitidos.
- Los destinatarios autorizados.
- Los tipos de operación permitidos.

El resultado es determinista e independiente de la respuesta de Gemini.

### Análisis consultivo mediante IA

El AI Engine utiliza Google Gemini para identificar indicadores de riesgo y contextos sospechosos en las operaciones.

Incluye medidas adicionales de protección:

- Sanitización de entradas.
- Detección de prompt injection.
- Validación de respuestas estructuradas.
- Guardrails para evitar afirmaciones no respaldadas de aprobación o ejecución.
- Fallback controlado cuando el proveedor de IA no está disponible.

El análisis de IA complementa el registro de la operación, pero nunca modifica la decisión del Policy Engine.

### Autenticación del servicio interno

La comunicación entre el backend y el AI Engine utiliza una clave interna compartida. El AI Engine valida el encabezado `X-Internal-Service-Key` antes de aceptar solicitudes de análisis.

## Alcance y limitaciones actuales

Actualmente, Sentinel proporciona controles de seguridad a nivel de backend y evaluación de operaciones.

El proyecto todavía no implementa:

- Aplicación de políticas directamente on-chain.
- Wallet sandboxing o entornos de ejecución aislados.
- Firma o ejecución automática de transacciones.
- Transferencias autónomas de fondos.
- Infraestructura completa de despliegue y administración de claves para producción.

Sentinel evalúa y registra operaciones; no las ejecuta de forma independiente.

## Roadmap

- [x] Autenticación API individual por agente.
- [x] Propiedad y aislamiento de políticas por agente.
- [x] Policy Engine determinista.
- [x] Persistencia de operaciones en PostgreSQL.
- [x] Integración del AI Engine con Gemini.
- [x] Arquitectura de IA exclusivamente consultiva.
- [x] Fallback y guardrails de respuestas de IA.
- [x] Autenticación interna entre backend y AI Engine.
- [x] Migraciones de base de datos con Alembic.
- [ ] Integración completa del frontend.
- [ ] Monitoreo avanzado y observabilidad de seguridad.
- [ ] Aplicación de políticas on-chain y wallet sandboxing.

## Track del hackathon

**AI Security & Defense — Trust, but verify.**

Sentinel demuestra cómo proteger agentes de IA mediante autenticación independiente, permisos aislados, aplicación determinista de políticas y análisis de riesgo asistido por IA, sin delegar las decisiones de seguridad a un modelo de inteligencia artificial.

## Licencia

Agrega la licencia elegida para el proyecto antes de distribuir Sentinel como software de código abierto.