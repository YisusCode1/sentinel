# Sentinel AI

[🇪🇸 Leer en español](README.es.md)

# Sentinel

**AI-Powered Agent Security & Defense**

Sentinel is a security backend designed to protect AI agents and automated systems from unauthorized or risky operations. It combines agent authentication, isolated security policies, deterministic policy enforcement, and AI-powered risk analysis to provide an additional layer of protection before operations are processed.

Built for the **NEAR Hackathon 2026**, under the **AI Security & Defense** track.

## The Problem

AI agents are increasingly capable of interacting with APIs, financial services, and blockchain infrastructure. However, granting agents access to sensitive operations without proper controls introduces risks such as:

- Unauthorized transfers or operations.
- Excessive spending and policy violations.
- Access to resources belonging to other agents.
- Prompt injection and malicious operation metadata.
- Lack of visibility into agent activity and risk.

Sentinel addresses these challenges by placing a security layer between agents and the operations they request.

## How Sentinel Works

Sentinel combines deterministic security rules with advisory AI risk analysis.

1. **Agent Authentication:** Each agent authenticates using its own API key.
2. **Policy Isolation:** Each agent can only access policies assigned to it.
3. **Deterministic Policy Engine:** Operations are checked against active policies, spending limits, allowed tokens, recipients, and operation types.
4. **AI Risk Analysis:** Operations approved by the Policy Engine are sent to the AI Engine for additional risk assessment.
5. **Persistence and Auditability:** The backend stores operation details and the deterministic decision. The current operation record does not persist the complete Gemini analysis.

The AI Engine is advisory only. It cannot approve, reject, authorize, or execute operations. The deterministic Policy Engine remains the sole authority for policy decisions.

## Architecture

```text
                    AI Agent
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
              | Authentication    |
              | Agent Isolation   |
              +-------------------+
                       |
                       v
              +-------------------+
              | Deterministic     |
              | Policy Engine     |
              +-------------------+
                       |
                +------+------+
                |             |
             REJECTED      APPROVED
                |             |
                |             v
                |     +-------------------+
                |     | AI Engine         |
                |     | Gemini Analysis  |
                |     +-------------------+
                |             |
                +------+------+
                       |
                       v
              +-------------------+
              | PostgreSQL        |
              | Operation Records |
              +-------------------+
                       |
                       v
                 API Response
```

The AI Engine runs as a separate service from the Docker Compose application. Communication between the backend and AI Engine is protected by an internal service key.

## Technology Stack

| Component | Technologies |
|---|---|
| Backend API | Python, FastAPI, Pydantic |
| Policy Engine | Python, deterministic rule evaluation |
| AI Engine | Python, FastAPI, Google Gemini |
| AI Model | Gemini 2.5 Flash |
| Database | PostgreSQL |
| ORM and migrations | SQLAlchemy, Alembic |
| HTTP communication | HTTPX |
| Frontend | React, TypeScript, Vite |
| Infrastructure | Docker, Docker Compose |

## Project Structure

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

## Getting Started

### Requirements

- Docker and Docker Compose.
- Python 3.12 or later for running Python services locally.
- Node.js and npm for frontend development.
- A Google Gemini API key for live AI analysis.

### 1. Clone the repository

```bash
git clone https://github.com/YisusCode1/sentinel.git
cd sentinel
```

### 2. Configure environment variables

Create the root environment file used by Docker Compose:

```bash
cp .env.example .env
```

Create the AI Engine environment file:

```bash
cp ai-engine/.env.example ai-engine/.env
```

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

Configure the following variables using your own values:

**Backend**

- `DATABASE_URL`: PostgreSQL connection string.
- `INTERNAL_SERVICE_KEY`: Secret shared with the AI Engine.
- `AI_ENGINE_URL`: AI Engine base URL. In the provided Docker Compose configuration, it defaults to `http://host.docker.internal:8002`.

**AI Engine**

- `GEMINI_API_KEY`: Google Gemini API key. Required for live Gemini analysis, but not for starting the service.
- `GEMINI_MODEL`: Model name. Defaults to `gemini-2.5-flash`.
- `GEMINI_TIMEOUT_SECONDS`: Gemini request timeout.
- `INTERNAL_SERVICE_KEY`: Must match the backend's internal service key.

**Frontend**

- `VITE_API_BASE_URL`: Backend API URL. The example configuration uses `http://localhost:8001`.

Do not commit `.env` files or expose API keys in source control.

### 3. Start PostgreSQL and the backend

```bash
docker compose up -d --build db backend
```

Run database migrations:

```bash
docker compose exec backend alembic upgrade head
```

### 4. Start the AI Engine

The AI Engine runs separately from Docker Compose in the provided development configuration.

From the project root:

```bash
cd ai-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

On Windows PowerShell, activate the virtual environment with:

```powershell
.venv\Scripts\Activate.ps1
```

Make sure the backend and AI Engine use the same `INTERNAL_SERVICE_KEY`.

Without a valid `GEMINI_API_KEY`, the service can start, but Gemini analysis will be unavailable and the backend will receive a fallback response.

### 5. Start the frontend

In another terminal:

```bash
docker compose up -d --build frontend
```

Alternatively, run it locally:

```bash
cd frontend
npm install
npm run dev
```

The development frontend is available at:

```text
http://localhost:5174
```

The backend API is available at:

```text
http://localhost:8001
```

## Agent Management

Agents are created and managed through the backend CLI. There is no public endpoint for creating agents.

Run the commands from the project root:

```bash
# Create an agent
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent create --name "Demo Agent"

# List agents
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent list

# Rotate an agent API key
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent key rotate AGENT_ID

# Revoke an API key
docker compose exec -e SENTINEL_ENV=development backend \
  python -m app.cli agent key revoke KEY_ID
```

**Important security notes:**

- API keys are generated individually for each agent.
- Only hashed API keys are stored in the database.
- The full API key is displayed when it is created or rotated. Store it securely because it cannot be retrieved later.
- Rotating a key deactivates the agent's previously active keys.
- Revoked keys can no longer authenticate requests.
- Production mutations require the explicit `--confirm-production` flag and `SENTINEL_ENV=production`.

For production, place the global CLI flag before the command:

```bash
docker compose exec -e SENTINEL_ENV=production backend \
  python -m app.cli --confirm-production agent create --name "Production Agent"
```

## API Endpoints

All agent-protected endpoints require the `X-API-Key` header.

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| GET | `/` | Public | API root |
| GET | `/api/v1/health` | Public | Backend health check |
| POST | `/api/v1/policies` | Agent API key | Create a policy for the authenticated agent |
| GET | `/api/v1/policies/{policy_id}` | Agent API key | Retrieve an agent-owned policy |
| POST | `/api/v1/operations/evaluate` | Agent API key | Evaluate an operation against its policy |
| GET | `/api/v1/operations` | Agent API key | Retrieve the authenticated agent's operations |

The AI Engine exposes:

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| GET | `/health` | Public | AI Engine health and configuration status |
| POST | `/analyze` | Internal service key | Advisory AI risk analysis |

The AI Engine's `/analyze` endpoint requires the `X-Internal-Service-Key` header.

## Security Model

### Agent Authentication

Each agent has its own API key. The backend validates the key, checks its status and expiration, and identifies the associated agent.

The backend does not trust an agent identity supplied in an operation payload.

### Policy Isolation

Policies belong to individual agents. The backend verifies policy ownership before evaluating operations, preventing one agent from accessing another agent's policies.

### Deterministic Policy Enforcement

The Policy Engine evaluates:

- Whether the policy is active.
- Maximum permitted operation amount.
- Allowed tokens.
- Allowed recipients.
- Allowed operation types.

The result is deterministic and independent of Gemini's response.

### Advisory AI Analysis

The AI Engine uses Google Gemini to identify potential risk indicators and suspicious operation context.

Additional safeguards include:

- Input sanitization.
- Prompt injection detection.
- Structured response validation.
- Output guardrails against unsupported approval or execution claims.
- Controlled fallback when the AI provider is unavailable.

AI analysis enriches the operation record but never changes the Policy Engine's decision.

### Internal Service Authentication

Backend-to-AI Engine communication uses a shared internal service key. The AI Engine validates the `X-Internal-Service-Key` header before accepting analysis requests.

## Current Scope and Limitations

Sentinel currently provides backend-level security controls and operation evaluation.

The project does not currently implement:

- On-chain transaction enforcement.
- Wallet sandboxing or isolated execution environments.
- Automatic transaction signing or execution.
- Autonomous fund transfers.
- A complete production-grade deployment and key-management infrastructure.

Sentinel evaluates and records operations; it does not independently execute them.

## Roadmap

- [x] Agent-specific API authentication.
- [x] Individual policy ownership and isolation.
- [x] Deterministic Policy Engine.
- [x] Operation persistence with PostgreSQL.
- [x] AI Engine integration with Gemini.
- [x] AI advisory-only architecture.
- [x] AI fallback and response guardrails.
- [x] Internal backend-to-AI authentication.
- [x] Database migrations with Alembic.
- [ ] Complete frontend integration.
- [ ] Advanced monitoring and security observability.
- [ ] On-chain enforcement and wallet sandboxing.

## Hackathon Track

**AI Security & Defense — Trust, but verify.**

Sentinel demonstrates how AI agents can be protected with independent authentication, isolated permissions, deterministic policy enforcement, and AI-assisted risk analysis without delegating security decisions to an AI model.

## License

Add the project's chosen license before distributing Sentinel as open-source software.