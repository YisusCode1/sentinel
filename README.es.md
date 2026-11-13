# Sentinel

**Seguridad y defensa para agentes de IA. Trust, but verify.**

[🇬🇧 Read in English](README.md)

Sentinel protege a los agentes de IA y a los sistemas automatizados frente a operaciones no autorizadas o riesgosas. Coloca una capa de seguridad entre el agente y el dinero que quiere mover: autenticación por agente, políticas aisladas, un Policy Engine determinista, análisis de riesgo consultivo con IA (Gemini) y un vault en Rust sobre NEAR que impone los límites de gasto en la cadena.

Construido para el **NEAR Hackathon 2026**, en el track **AI Security & Defense**.

## Contenido

- [El problema](#el-problema)
- [Cómo funciona Sentinel](#cómo-funciona-sentinel)
- [Inicio rápido](#inicio-rápido)
- [Arquitectura](#arquitectura)
- [Límites de gasto on-chain (NEAR testnet)](#límites-de-gasto-on-chain-near-testnet)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Configuración](#configuración)
- [Gestión de agentes](#gestión-de-agentes)
- [Endpoints de la API](#endpoints-de-la-api)
- [Modelo de seguridad](#modelo-de-seguridad)
- [Frontend](#frontend)
- [Pruebas](#pruebas)
- [Alcance actual y limitaciones](#alcance-actual-y-limitaciones)
- [Hoja de ruta](#hoja-de-ruta)
- [Equipo](#equipo)
- [Track del hackathon](#track-del-hackathon)

## El problema

Los agentes de IA ya pueden usar APIs, servicios financieros e infraestructura blockchain. Darles acceso a operaciones sensibles sin controles introduce riesgos como:

- Transferencias u operaciones no autorizadas.
- Gasto excesivo y violaciones de políticas.
- Acceso a recursos que pertenecen a otros agentes.
- Inyección de prompts y metadatos maliciosos en las operaciones.
- Falta de visibilidad sobre lo que hace un agente y su nivel de riesgo.

Sentinel permite darle dinero a un agente sin darle las llaves de todo.

## Cómo funciona Sentinel

Sentinel combina reglas deterministas, análisis consultivo con IA y control en la cadena. Hay dos capas independientes.

**Capa 1: API de Sentinel (off-chain)**

1. **Autenticación por agente:** cada agente se autentica con su propia API key (`X-API-Key`).
2. **Aislamiento de políticas:** un agente solo puede ver y usar sus propias políticas.
3. **Policy Engine determinista:** comprueba que la política esté activa, el límite de monto, los tokens, destinatarios y tipos de operación permitidos.
4. **Análisis consultivo con IA:** las operaciones aprobadas por el Policy Engine se envían al AI Engine (Gemini) para una evaluación de riesgo.
5. **Auditoría:** cada operación, su decisión y su análisis de IA se guardan en PostgreSQL.

**Capa 2: vault en NEAR (on-chain)**

6. El agente nunca tiene los fondos. Un contrato inteligente en Rust los custodia y vuelve a comprobar el límite por operación, el límite de 24 horas y la lista de destinatarios en cada transferencia, así que los límites se mantienen aunque la capa 1 apruebe por error.

El AI Engine es **solo consultivo**. No puede aprobar, rechazar, autorizar ni ejecutar operaciones. El Policy Engine determinista es la única autoridad para las decisiones de política.

## Inicio rápido

Necesitas Docker con Docker Compose. La API key de Gemini es opcional (ver la nota más abajo).

```bash
git clone https://github.com/YisusCode1/sentinel.git
cd sentinel
cp .env.example .env
```

Edita `.env`:

- `INTERNAL_SERVICE_KEY`: define un secreto aleatorio compartido por el backend y el AI Engine. Por ejemplo: `openssl rand -hex 32`. Docker Compose no arranca sin ella.
- `GEMINI_API_KEY` (opcional): una clave de Google AI Studio (empieza por `AIza`). Sin ella todo funciona, pero las operaciones aprobadas devuelven `risk_level: "unknown"` y `analysis_available: false`, y el Policy Engine sigue decidiendo.

Levanta todo (base de datos, backend, AI Engine y frontend):

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8001/api/v1/health
```

Los cuatro servicios deben estar sanos y el health check responder `{"status":"healthy","service":"sentinel-backend"}`. Si alguna vez ves errores de tablas inexistentes, ejecuta `docker compose exec backend alembic upgrade head`.

Crea un agente con su API key y una política de ejemplo (USDT, `transfer`, máximo 500):

```bash
docker compose exec backend python -m app.scripts.create_agent --name demo-agent --demo-policy
```

El comando imprime el `agent_id`, el `policy_id` y la API key. **La clave se muestra una sola vez**; en la base de datos solo se guarda su hash.

Después abre el panel en <http://localhost:5174>, ve a la pantalla de configuración y pega la clave, o usa la API:

```bash
export SENTINEL_API_KEY=<clave impresa arriba>
export POLICY_ID=<policy_id impreso arriba>

# Dentro de la política: aprobada, con el análisis consultivo de Gemini (tarda unos segundos)
curl -s -X POST http://localhost:8001/api/v1/operations/evaluate \
  -H "Content-Type: application/json" -H "X-API-Key: $SENTINEL_API_KEY" \
  -d "{\"policy_id\":\"$POLICY_ID\",\"network\":\"near\",\"operation\":\"transfer\",\"token\":\"USDT\",\"amount\":\"10\",\"recipient\":\"0x742d35Cc6634C0532925a3b844Bc454e4438f44e\"}"

# Por encima del límite de la política: rechazada por el Policy Engine, sin llamada a la IA
curl -s -X POST http://localhost:8001/api/v1/operations/evaluate \
  -H "Content-Type: application/json" -H "X-API-Key: $SENTINEL_API_KEY" \
  -d "{\"policy_id\":\"$POLICY_ID\",\"network\":\"near\",\"operation\":\"transfer\",\"token\":\"USDT\",\"amount\":\"1000\",\"recipient\":\"0x742d35Cc6634C0532925a3b844Bc454e4438f44e\"}"

# Historial del agente autenticado
curl -s "http://localhost:8001/api/v1/operations?limit=5" -H "X-API-Key: $SENTINEL_API_KEY"
```

| Servicio | URL |
|---|---|
| Panel (frontend) | http://localhost:5174 |
| API del backend | http://localhost:8001 |
| AI Engine (interno, solo en localhost) | http://localhost:8002 |

Para detenerlo todo usa `docker compose down` (añade `-v` para borrar también el volumen de la base de datos).

## Arquitectura

```
                  Agente de IA
                       |
                       | X-API-Key
                       v
              +-------------------+
              |   API Sentinel    |
              |      FastAPI      |
              +-------------------+
                       |
                       v
              +-------------------+
              | Autenticación     |
              | Aislamiento       |
              +-------------------+
                       |
                       v
              +-------------------+
              | Policy Engine     |
              | determinista      |
              +-------------------+
                       |
                +------+------+
                |             |
            RECHAZADA      APROBADA
                |             |
                |             v
                |     +-------------------+
                |     | AI Engine         |
                |     | Gemini (consulta) |
                |     +-------------------+
                |             |
                +------+------+
                       |
                       v
              +-------------------+
              | PostgreSQL        |
              | Registro de ops   |
              +-------------------+
                       |
                       v
               Respuesta de la API
```

Capa on-chain, independiente de la API:

```
   Cuenta del agente --request_transfer--> Contrato vault (NEAR, Rust)
                                            |  límite por operación
                                            |  límite de 24 horas
                                            |  lista de destinatarios
                                            |  pausa / revocación por el dueño
                                            v
                                  transferencia, o reversión con un error
```

El AI Engine corre como un servicio propio en Docker Compose. La comunicación entre el backend y el AI Engine está protegida por una clave de servicio interna. Si el proveedor de IA falla o excede el tiempo, la operación se evalúa y se guarda igualmente con un análisis de respaldo `unknown`.

## Límites de gasto on-chain (NEAR testnet)

`contracts/near` es un vault en Rust desplegado en **`sentinel-vault-ia.testnet`**.
El dueño registra la cuenta de un agente con un límite por operación, un límite
de 24 horas y una lista de destinatarios permitidos. El agente solo puede llamar
a `request_transfer`; el contrato vuelve a comprobar cada regla en la cadena,
así que los límites se mantienen aunque la capa off-chain apruebe por error.

Dos capas independientes:
1. API de Sentinel: el Policy Engine determinista decide, Gemini solo asesora.
2. Vault en NEAR: impone los límites on-chain (solo NEAR nativo).

### Interfaz del contrato

| Método | Quién lo llama | Descripción |
|---|---|---|
| `new(owner)` | quien despliega | Inicializa el vault con una cuenta dueña |
| `deposit()` | cualquiera (payable) | Añade fondos al vault |
| `set_agent_policy(agent, max_per_tx, daily_limit, allowed_recipients)` | dueño | Registra o reemplaza los límites de un agente y reinicia su ventana de 24 horas |
| `pause_agent(agent)` / `resume_agent(agent)` | dueño | Bloquea o desbloquea temporalmente a un agente |
| `remove_agent(agent)` | dueño | Revoca los permisos del agente |
| `request_transfer(recipient, amount)` | agente | Transfiere NEAR nativo si se cumplen todas las reglas; si no, revierte con un error |
| `get_agent_policy(agent)` / `get_owner()` | consulta | Lee la política guardada y el dueño |

Los montos van en yoctoNEAR (1 NEAR = 10^24) y se pasan como strings. Cada cambio de estado registra una línea `EVENT_JSON`.

### Demo

Configuración usada en la demo: agente `sentinel-agent-ia.testnet`, destinatario permitido `sentinel-treasury-ia.testnet`, límites del vault de 1 NEAR por operación y 2 NEAR por día. La política de Sentinel es más permisiva a propósito (5 NEAR), para mostrar que el vault es la última línea de defensa.

`scripts/demo_onchain.sh <destinatario> <monto>` pide a Sentinel que evalúe la operación y, solo si la aprueba, llama al vault como agente:

- 0.4 NEAR al destinatario permitido: aprobada y ejecutada
  ([tx](https://explorer.testnet.near.org/transactions/kZKJCnBX56RJbz2Sk3ceSJnRnRWibeXeuRM3RjPNMCB)).
- 0.1 NEAR a un destinatario no permitido: rechazada por Sentinel, sin llamada on-chain.
- 1.5 NEAR: aprobada por Sentinel (límite 5), revertida por el vault (límite 1)
  ([tx](https://explorer.testnet.near.org/transactions/GgFMigNyrHQzqxoxahLCFNMz8cF4x4XFTgUesvTC3NHH)).

El script necesita `near-cli-rs`, tus propias cuentas de testnet y las variables `SENTINEL_API_KEY` y `POLICY_ID` (una política de Sentinel para el token `NEAR`). Todo lo anterior también se puede verificar en el explorador sin ejecutar nada.

### Compilación y llamadas manuales

```bash
cd contracts/near
cargo near build non-reproducible-wasm
```

```bash
# El dueño registra al agente (1 NEAR por operación, 2 NEAR por día)
near contract call-function as-transaction sentinel-vault-ia.testnet set_agent_policy \
  json-args '{"agent":"sentinel-agent-ia.testnet","max_per_tx":"1000000000000000000000000","daily_limit":"2000000000000000000000000","allowed_recipients":["sentinel-treasury-ia.testnet"]}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as sentinel-vault-ia.testnet network-config testnet sign-with-keychain send

# El agente pide una transferencia de 0.5 NEAR
near contract call-function as-transaction sentinel-vault-ia.testnet request_transfer \
  json-args '{"recipient":"sentinel-treasury-ia.testnet","amount":"500000000000000000000000"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as sentinel-agent-ia.testnet network-config testnet sign-with-keychain send
```

### Limitaciones

- Solo NEAR nativo (sin tokens).
- El script de demo orquesta ambas capas; el backend no llama al contrato.
- Una transferencia rechazada es una transacción revertida con un mensaje de error, no un registro aparte.
- En la demo el dueño es la propia cuenta del contrato. En producción debe usarse una cuenta dueña distinta.
- Gemini aún no recibe historial de transacciones, por eso siempre indica `limited_historical_context`.

## Tecnologías

| Componente | Tecnologías |
|---|---|
| API del backend | Python, FastAPI, Pydantic |
| Policy Engine | Python, evaluación determinista de reglas |
| AI Engine | Python, FastAPI, Google Gemini (`google-genai`) |
| Modelo de IA | Gemini 2.5 Flash |
| Base de datos | PostgreSQL 16 |
| ORM y migraciones | SQLAlchemy, Alembic |
| Comunicación HTTP | HTTPX |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Contrato inteligente | Rust, near-sdk, NEAR testnet |
| Infraestructura | Docker, Docker Compose |

## Estructura del proyecto

```
sentinel/
├── backend/
│   ├── alembic/versions/
│   ├── app/
│   │   ├── core/            # auth.py, database.py, security.py
│   │   ├── schemas/
│   │   ├── scripts/         # create_agent.py
│   │   ├── services/        # ai_client.py, policy_engine.py, ...
│   │   ├── cli.py           # CLI administrativa
│   │   ├── main.py
│   │   └── models.py
│   ├── tests/
│   └── requirements.txt
├── ai-engine/
│   ├── analyzer/            # integración con Gemini, prompts, sanitizador, esquemas
│   ├── app/                 # servicio FastAPI
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
├── contracts/
│   └── near/                # contrato vault en Rust
├── scripts/
│   └── demo_onchain.sh      # decisión de Sentinel + vault en NEAR
├── docs/
│   └── api_contract.md
├── docker-compose.yml
├── README.md
└── README.es.md
```

## Configuración

Docker Compose lee el archivo `.env` de la raíz. Parte de `.env.example` y nunca subas claves reales.

| Variable | La usa | Descripción |
|---|---|---|
| `INTERNAL_SERVICE_KEY` | backend, AI Engine | Obligatoria. Secreto compartido por ambos servicios. |
| `GEMINI_API_KEY` | AI Engine | Opcional. Clave de Google AI Studio (`AIza...`). Necesaria para el análisis real. |
| `GEMINI_MODEL` | AI Engine | Nombre del modelo. Por defecto `gemini-2.5-flash`. |
| `GEMINI_TIMEOUT_SECONDS` | AI Engine | Tiempo máximo de la solicitud a Gemini. Por defecto 15 (Google exige al menos 10). |
| `VITE_API_BASE_URL` | frontend | URL de la API del backend. Por defecto `http://localhost:8001`. |

Los tiempos de espera están encadenados a propósito: AI Engine 15 s, el backend espera hasta 20 s al AI Engine y el frontend hasta 30 s al backend.

## Gestión de agentes

Los agentes los crea un administrador desde el servidor. No existe un endpoint público para crear agentes.

Creación rápida (la usada en el inicio rápido):

```bash
docker compose exec backend python -m app.scripts.create_agent --name demo-agent --demo-policy
```

CLI administrativa:

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

Notas de seguridad:

- Las API keys se generan de forma individual para cada agente.
- En la base de datos solo se guardan las claves en forma de hash.
- La clave completa se muestra solo al crearla o rotarla. No se puede recuperar después.
- Rotar una clave desactiva las claves activas anteriores del agente. Las claves revocadas dejan de autenticar.
- Las modificaciones en producción exigen `SENTINEL_ENV=production` y la bandera explícita `--confirm-production`:

```bash
docker compose exec -e SENTINEL_ENV=production backend \
  python -m app.cli --confirm-production agent create --name "Production Agent"
```

## Endpoints de la API

Todos los endpoints, salvo `GET /` y `GET /api/v1/health`, requieren el header `X-API-Key`. El contrato completo está en [`docs/api_contract.md`](docs/api_contract.md).

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Raíz de la API (pública) |
| GET | `/api/v1/health` | Estado del backend (público) |
| POST | `/api/v1/policies` | Crea una política para el agente autenticado |
| GET | `/api/v1/policies` | Lista las políticas del agente |
| GET | `/api/v1/policies/{policy_id}` | Consulta una política del agente |
| POST | `/api/v1/operations/evaluate` | Evalúa una operación contra una política |
| GET | `/api/v1/operations` | Lista las operaciones del agente (filtros `decision` y `limit`) |
| GET | `/api/v1/operations/{operation_id}` | Consulta una operación con su análisis de IA |

Notas: los montos son strings (por ejemplo `"10.00000000"`); los campos desconocidos, incluido `agent_id`, se rechazan con `422`; una política u operación de otro agente responde `404`.

El AI Engine expone `GET /health` (público) y `POST /analyze`, que exige el header `X-Internal-Service-Key` y no está pensado para los agentes.

## Modelo de seguridad

**Autenticación por agente.** Cada agente tiene su propia API key. El backend valida la clave, su estado y su expiración, e identifica al agente. Nunca confía en una identidad enviada dentro de la solicitud.

**Aislamiento de políticas.** Las políticas y operaciones pertenecen a cada agente. El backend verifica la pertenencia en cada lectura y evaluación. Un recurso de otro agente es indistinguible de uno inexistente. Además, la base de datos garantiza que una operación solo pueda referirse a una política del mismo agente.

**Aplicación determinista de políticas.** El Policy Engine evalúa si la política está activa, el tipo de operación, el token, el destinatario y el monto máximo. La comparación de tokens y operaciones ignora mayúsculas y espacios; las direcciones de estilo EVM se comparan sin distinguir mayúsculas y las demás de forma exacta. Todo lo inesperado se rechaza (fail-closed). El resultado no depende de Gemini.

**Análisis consultivo con IA.** El AI Engine usa Gemini para señalar indicadores de riesgo. Las salvaguardas incluyen sanitización de entradas, detección de inyección de prompts, validación de la respuesta estructurada, guardrails contra afirmaciones de aprobación o ejecución no respaldadas y un respaldo controlado cuando el proveedor no está disponible. El análisis enriquece el registro de la operación pero nunca cambia la decisión del Policy Engine, y solo se solicita para operaciones que el Policy Engine ya aprobó.

**Autenticación de servicio interna.** El backend se autentica ante el AI Engine con `X-Internal-Service-Key`. El AI Engine responde `401` sin ella y solo se publica en localhost.

**Control on-chain.** El vault de NEAR vuelve a comprobar los límites y la lista de destinatarios, independientemente de la API.

## Frontend

El panel es una aplicación React y TypeScript en español, inglés y portugués.

- La API key se guarda **solo en memoria**. Nunca se escribe en `localStorage`, `sessionStorage`, cookies ni en el bundle, así que al recargar la página hay que ingresarla de nuevo. En el navegador solo se guarda el idioma elegido.
- Políticas, evaluación de operaciones, historial con filtros y detalle, y alertas de operaciones rechazadas, todo con la API real.
- La decisión del Policy Engine y el análisis consultivo de Gemini se muestran por separado. Cuando el análisis no está disponible la interfaz lo indica y no muestra la puntuación de respaldo.
- Sin métricas ni actividad on-chain simuladas.

## Pruebas

```bash
# Backend: seguridad, aislamiento, Policy Engine (no necesita PostgreSQL; usa SQLite en memoria)
cd backend && python -m pytest

# AI Engine
cd ai-engine && python -m pytest

# Frontend
cd frontend && npm install && npm test
```

Crea antes un entorno virtual e instala el `requirements.txt` de cada servicio.

## Alcance actual y limitaciones

- Sentinel evalúa y registra operaciones. El backend no firma ni ejecuta transacciones.
- El vault de NEAR impone límites on-chain solo para NEAR nativo en testnet. El script de demo conecta ambas capas; el backend todavía no llama al contrato.
- No hay registro público de agentes: los crea un administrador.
- El análisis de Gemini aún no tiene historial de transacciones, por eso siempre indica contexto histórico limitado. Tarda unos segundos por solicitud.
- No es un despliegue de producción: sin límite de intentos, sin infraestructura de gestión de claves y sin claves de idempotencia.

## Hoja de ruta

Hecho:

- [x] Autenticación por API key de cada agente, rotación y revocación
- [x] Propiedad individual y aislamiento de políticas
- [x] Policy Engine determinista
- [x] Persistencia de operaciones con PostgreSQL y migraciones con Alembic
- [x] Análisis consultivo con Gemini, con guardrails y respaldo
- [x] Autenticación interna entre el backend y el AI Engine
- [x] Integración del frontend
- [x] Vault en Rust sobre NEAR testnet con límites de gasto on-chain

Siguiente, en el orden en que lo abordaríamos:

- [ ] Consola de administración (o endpoint protegido con clave de administrador) para crear agentes y rotar claves desde la interfaz
- [ ] Integración backend y vault: que la API llame a `request_transfer` tras aprobar una operación
- [ ] Historial de transacciones para Gemini (monto promedio, destinatario nuevo, actividad reciente)
- [ ] Límite de intentos y bloqueo en la autenticación por API key
- [ ] Claves de idempotencia en `POST /operations/evaluate`
- [ ] Cuenta dueña del vault distinta; function-call keys de NEAR para el proceso del agente
- [ ] Tokens fungibles (NEP-141) y soporte multi-red
- [ ] Límite diario por política en la API
- [ ] Ancla de auditoría on-chain: guardar el hash de cada decisión aprobada
- [ ] Reputación de agentes y detección de destinatarios fraudulentos
- [ ] Atestación TEE para el AI Engine
- [ ] Monitoreo y observabilidad de seguridad

## Equipo

| Nombre | Rol |
|---|---|
| Geraldin Nuñez | Frontend |
| Roberto Vasquez | Frontend |
| Franco Mendoza | IA, Backend y apoyo en Frontend |
| Jesús Alfaro | Líder del equipo, Blockchain, Backend |

## Track del hackathon

**AI Security & Defense: Trust, but verify.**

Sentinel muestra cómo darle dinero a un agente de IA sin darle las llaves de todo: autenticación independiente, permisos aislados, aplicación determinista de políticas, análisis de riesgo asistido por IA que nunca toma la decisión y límites de gasto impuestos en la cadena.

## Licencia

Aún no especificada.
