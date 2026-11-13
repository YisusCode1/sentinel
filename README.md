# Sentinel

**AI-Powered Agent Security & Defense. Trust, but verify.**

[🇪🇸 Leer en español](README.es.md)

Sentinel protects AI agents and automated systems from unauthorized or risky operations. It places a security layer between an agent and the money it wants to move: agent authentication, isolated policies, a deterministic Policy Engine, advisory AI risk analysis (Gemini), and a Rust vault on NEAR that enforces spending limits on-chain.

Built for the **NEAR Hackathon 2026**, under the **AI Security & Defense** track.

## Contents

- [The Problem](#the-problem)
- [How Sentinel Works](#how-sentinel-works)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [On-chain Spending Limits (NEAR testnet)](#on-chain-spending-limits-near-testnet)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Agent Management](#agent-management)
- [API Endpoints](#api-endpoints)
- [Security Model](#security-model)
- [Frontend](#frontend)
- [Tests](#tests)
- [Current Scope and Limitations](#current-scope-and-limitations)
- [Roadmap](#roadmap)
- [Team](#team)
- [Hackathon Track](#hackathon-track)

## The Problem

AI agents can already call APIs, financial services and blockchain infrastructure. Giving them access to sensitive operations without controls introduces risks such as:

- Unauthorized transfers or operations.
- Excessive spending and policy violations.
- Access to resources that belong to other agents.
- Prompt injection and malicious operation metadata.
- No visibility into what an agent does or how risky it is.

Sentinel gives an agent money without giving it the keys to everything.

## How Sentinel Works

Sentinel combines deterministic rules, advisory AI analysis and on-chain enforcement. There are two independent layers.

**Layer 1: Sentinel API (off-chain)**

1. **Agent authentication:** each agent authenticates with its own API key (`X-API-Key`).
2. **Policy isolation:** an agent can only see and use its own policies.
3. **Deterministic Policy Engine:** checks that the policy is active, the amount limit, the allowed tokens, recipients and operation types.
4. **Advisory AI analysis:** operations approved by the Policy Engine are sent to the AI Engine (Gemini) for a risk assessment.
5. **Auditability:** every operation, its decision and its AI analysis are stored in PostgreSQL.

**Layer 2: NEAR vault (on-chain)**

6. The agent never holds the funds. A Rust smart contract holds them and re-checks the per-transaction limit, the 24-hour limit and the recipient allowlist on every transfer, so the limits hold even if layer 1 approves by mistake.

The AI Engine is **advisory only**. It cannot approve, reject, authorize or execute operations. The deterministic Policy Engine is the only authority for policy decisions.

## Quick Start

You need Docker with Docker Compose. A Gemini API key is optional (see the note below).

```bash
git clone https://github.com/YisusCode1/sentinel.git
cd sentinel
cp .env.example .env
```

Edit `.env`:

- `INTERNAL_SERVICE_KEY`: set a random secret shared by the backend and the AI Engine. For example: `openssl rand -hex 32`. Docker Compose refuses to start without it.
- `GEMINI_API_KEY` (optional): a Google AI Studio key (it starts with `AIza`). Without it everything works, but approved operations return `risk_level: "unknown"` and `analysis_available: false`, and the Policy Engine still decides.

Start everything (database, backend, AI Engine and frontend):

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8001/api/v1/health
```

The four services should be healthy and the health check should answer `{"status":"healthy","service":"sentinel-backend"}`. If you ever see missing-table errors, run `docker compose exec backend alembic upgrade head`.

Create an agent with an API key and a demo policy (USDT, `transfer`, maximum 500):

```bash
docker compose exec backend python -m app.scripts.create_agent --name demo-agent --demo-policy
```

The command prints the `agent_id`, the `policy_id` and the API key. **The key is shown only once**; only its hash is stored.

Then either open the dashboard at <http://localhost:5174>, go to the configuration screen and paste the key, or use the API:

```bash
export SENTINEL_API_KEY=<key printed above>
export POLICY_ID=<policy_id printed above>

# Within the policy: approved, with Gemini's advisory analysis (takes a few seconds)
curl -s -X POST http://localhost:8001/api/v1/operations/evaluate \
  -H "Content-Type: application/json" -H "X-API-Key: $SENTINEL_API_KEY" \
  -d "{\"policy_id\":\"$POLICY_ID\",\"network\":\"near\",\"operation\":\"transfer\",\"token\":\"USDT\",\"amount\":\"10\",\"recipient\":\"0x742d35Cc6634C0532925a3b844Bc454e4438f44e\"}"

# Above the policy limit: rejected by the Policy Engine, no AI call
curl -s -X POST http://localhost:8001/api/v1/operations/evaluate \
  -H "Content-Type: application/json" -H "X-API-Key: $SENTINEL_API_KEY" \
  -d "{\"policy_id\":\"$POLICY_ID\",\"network\":\"near\",\"operation\":\"transfer\",\"token\":\"USDT\",\"amount\":\"1000\",\"recipient\":\"0x742d35Cc6634C0532925a3b844Bc454e4438f44e\"}"

# History of the authenticated agent
curl -s "http://localhost:8001/api/v1/operations?limit=5" -H "X-API-Key: $SENTINEL_API_KEY"
```

| Service | URL |
|---|---|
| Frontend dashboard | http://localhost:5174 |
| Backend API | http://localhost:8001 |
| AI Engine (internal, bound to localhost) | http://localhost:8002 |

Stop everything with `docker compose down` (add `-v` to also delete the database volume).

## Architecture

```
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
                |     | Gemini (advisory) |
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

On-chain layer, independent of the API:

```
   Agent account  --request_transfer-->  Vault contract (NEAR, Rust)
                                          |  per-transaction limit
                                          |  24-hour limit
                                          |  recipient allowlist
                                          |  pause / revoke by the owner
                                          v
                                   transfer, or revert with an error
```

The AI Engine runs as its own service in Docker Compose. Communication between the backend and the AI Engine is protected by an internal service key. If the AI provider fails or times out, the operation is still evaluated and stored with an `unknown` fallback analysis.

## On-chain Spending Limits (NEAR testnet)

`contracts/near` is a Rust vault deployed at **`sentinel-vault-ia.testnet`**.
The owner registers an agent account with a per-transaction limit, a 24-hour
limit and an allowlist of recipients. The agent can only call
`request_transfer`; the contract re-checks every rule on-chain, so the limits
hold even if the off-chain layer approves by mistake.

Two independent layers:
1. Sentinel API: the deterministic Policy Engine decides, Gemini only advises.
2. NEAR vault: enforces limits on-chain (native NEAR only).

### Contract interface

| Method | Caller | Description |
|---|---|---|
| `new(owner)` | deployer | Initializes the vault with an owner account |
| `deposit()` | anyone (payable) | Adds funds to the vault |
| `set_agent_policy(agent, max_per_tx, daily_limit, allowed_recipients)` | owner | Registers or replaces an agent's limits and resets its 24-hour window |
| `pause_agent(agent)` / `resume_agent(agent)` | owner | Temporarily blocks or unblocks an agent |
| `remove_agent(agent)` | owner | Revokes the agent's permissions |
| `request_transfer(recipient, amount)` | agent | Transfers native NEAR if every rule passes, otherwise reverts with an error |
| `get_agent_policy(agent)` / `get_owner()` | view | Reads the stored policy and owner |

Amounts are in yoctoNEAR (1 NEAR = 10^24) and are passed as strings. Every state change logs an `EVENT_JSON` line.

### Demo

Setup used in the demo: agent `sentinel-agent-ia.testnet`, allowed recipient `sentinel-treasury-ia.testnet`, vault limits of 1 NEAR per transaction and 2 NEAR per day. The Sentinel policy is deliberately looser (5 NEAR) to show that the vault is the last line of defense.

`scripts/demo_onchain.sh <recipient> <amount>` asks Sentinel to evaluate the operation and, only if it is approved, calls the vault as the agent:

- 0.4 NEAR to the allowed recipient: approved and executed
  ([tx](https://explorer.testnet.near.org/transactions/kZKJCnBX56RJbz2Sk3ceSJnRnRWibeXeuRM3RjPNMCB)).
- 0.1 NEAR to a non-allowed recipient: rejected by Sentinel, no on-chain call.
- 1.5 NEAR: approved by Sentinel (limit 5), reverted by the vault (limit 1)
  ([tx](https://explorer.testnet.near.org/transactions/GgFMigNyrHQzqxoxahLCFNMz8cF4x4XFTgUesvTC3NHH)).

The script needs `near-cli-rs`, your own testnet accounts and the variables `SENTINEL_API_KEY` and `POLICY_ID` (a Sentinel policy for the `NEAR` token). Everything above can also be verified in the explorer without running anything.

### Build and manual calls

```bash
cd contracts/near
cargo near build non-reproducible-wasm
```

```bash
# Owner registers the agent (1 NEAR per tx, 2 NEAR per day)
near contract call-function as-transaction sentinel-vault-ia.testnet set_agent_policy \
  json-args '{"agent":"sentinel-agent-ia.testnet","max_per_tx":"1000000000000000000000000","daily_limit":"2000000000000000000000000","allowed_recipients":["sentinel-treasury-ia.testnet"]}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as sentinel-vault-ia.testnet network-config testnet sign-with-keychain send

# The agent asks for a transfer of 0.5 NEAR
near contract call-function as-transaction sentinel-vault-ia.testnet request_transfer \
  json-args '{"recipient":"sentinel-treasury-ia.testnet","amount":"500000000000000000000000"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as sentinel-agent-ia.testnet network-config testnet sign-with-keychain send
```

### Limitations

- Native NEAR only (no tokens).
- The demo script orchestrates both layers; the backend does not call the contract.
- A rejected transfer is a reverted transaction with an error message, not a separate record.
- In the demo the owner is the contract account itself. Use a separate owner account in production.
- Gemini receives no transaction history yet, so it always reports `limited_historical_context`.

## Technology Stack

| Component | Technologies |
|---|---|
| Backend API | Python, FastAPI, Pydantic |
| Policy Engine | Python, deterministic rule evaluation |
| AI Engine | Python, FastAPI, Google Gemini (`google-genai`) |
| AI Model | Gemini 2.5 Flash |
| Database | PostgreSQL 16 |
| ORM and migrations | SQLAlchemy, Alembic |
| HTTP communication | HTTPX |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Smart contract | Rust, near-sdk, NEAR testnet |
| Infrastructure | Docker, Docker Compose |

## Project Structure

```
sentinel/
├── backend/
│   ├── alembic/versions/
│   ├── app/
│   │   ├── core/            # auth.py, database.py, security.py
│   │   ├── schemas/
│   │   ├── scripts/         # create_agent.py
│   │   ├── services/        # ai_client.py, policy_engine.py, ...
│   │   ├── cli.py           # administrative CLI
│   │   ├── main.py
│   │   └── models.py
│   ├── tests/
│   └── requirements.txt
├── ai-engine/
│   ├── analyzer/            # Gemini integration, prompts, sanitizer, schemas
│   ├── app/                 # FastAPI service
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
├── contracts/
│   └── near/                # Rust vault contract
├── scripts/
│   └── demo_onchain.sh      # Sentinel decision + NEAR vault
├── docs/
│   └── api_contract.md
├── docker-compose.yml
├── README.md
└── README.es.md
```

## Configuration

Docker Compose reads the root `.env` file. Start from `.env.example` and never commit real keys.

| Variable | Used by | Description |
|---|---|---|
| `INTERNAL_SERVICE_KEY` | backend, AI Engine | Required. Secret shared by both services. |
| `GEMINI_API_KEY` | AI Engine | Optional. Google AI Studio key (`AIza...`). Needed for live analysis. |
| `GEMINI_MODEL` | AI Engine | Model name. Defaults to `gemini-2.5-flash`. |
| `GEMINI_TIMEOUT_SECONDS` | AI Engine | Gemini request timeout. Defaults to 15 (Google requires at least 10). |
| `VITE_API_BASE_URL` | frontend | Backend API URL. Defaults to `http://localhost:8001`. |

Timeouts are chained on purpose: AI Engine 15 s, backend waits up to 20 s for the AI Engine, frontend waits up to 30 s for the backend.

## Agent Management

Agents are created by an administrator from the server. There is no public endpoint for creating agents.

Quick creation (used in the Quick Start):

```bash
docker compose exec backend python -m app.scripts.create_agent --name demo-agent --demo-policy
```

Administrative CLI:

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

Security notes:

- API keys are generated individually for each agent.
- Only hashed API keys are stored in the database.
- The full key is shown only when it is created or rotated. It cannot be retrieved later.
- Rotating a key deactivates the agent's previously active keys. Revoked keys can no longer authenticate.
- Production mutations require `SENTINEL_ENV=production` and the explicit `--confirm-production` flag:

```bash
docker compose exec -e SENTINEL_ENV=production backend \
  python -m app.cli --confirm-production agent create --name "Production Agent"
```

## API Endpoints

All endpoints except `GET /` and `GET /api/v1/health` require the `X-API-Key` header. The full contract is in [`docs/api_contract.md`](docs/api_contract.md).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API root (public) |
| GET | `/api/v1/health` | Backend health check (public) |
| POST | `/api/v1/policies` | Create a policy for the authenticated agent |
| GET | `/api/v1/policies` | List the agent's policies |
| GET | `/api/v1/policies/{policy_id}` | Retrieve an agent-owned policy |
| POST | `/api/v1/operations/evaluate` | Evaluate an operation against a policy |
| GET | `/api/v1/operations` | List the agent's operations (`decision` and `limit` filters) |
| GET | `/api/v1/operations/{operation_id}` | Retrieve one operation with its AI analysis |

Notes: amounts are strings (for example `"10.00000000"`); unknown fields, including `agent_id`, are rejected with `422`; a policy or operation owned by another agent answers `404`.

The AI Engine exposes `GET /health` (public) and `POST /analyze`, which requires the `X-Internal-Service-Key` header and is not meant for agents.

## Security Model

**Agent authentication.** Each agent has its own API key. The backend validates the key, its status and expiration, and identifies the agent. It never trusts an identity supplied in the request payload.

**Policy isolation.** Policies and operations belong to individual agents. The backend verifies ownership on every read and evaluation. A resource of another agent is indistinguishable from a missing one. The database also enforces that an operation can only reference a policy of the same agent.

**Deterministic policy enforcement.** The Policy Engine evaluates whether the policy is active, the operation type, the token, the recipient and the maximum amount. Token and operation matching ignores case and surrounding spaces; EVM-style addresses are compared case-insensitively and every other address exactly. Anything unexpected is rejected (fail-closed). The result does not depend on Gemini.

**Advisory AI analysis.** The AI Engine uses Gemini to flag risk indicators. Safeguards include input sanitization, prompt injection detection, structured response validation, output guardrails against unsupported approval or execution claims, and a controlled fallback when the provider is unavailable. The analysis enriches the operation record but never changes the Policy Engine's decision, and it is only requested for operations the Policy Engine already approved.

**Internal service authentication.** The backend authenticates to the AI Engine with `X-Internal-Service-Key`. The AI Engine answers `401` without it and is only published on localhost.

**On-chain enforcement.** The NEAR vault re-checks the limits and the recipient allowlist, independently of the API.

## Frontend

The dashboard is a React and TypeScript application in Spanish, English and Portuguese.

- The API key is kept **in memory only**. It is never written to `localStorage`, `sessionStorage`, cookies or the bundle, so reloading the page requires entering it again. Only the selected language is stored in the browser.
- Policies, operation evaluation, history with filters and detail, and alerts for rejected operations, all backed by the real API.
- The Policy Engine's decision and Gemini's advisory analysis are shown separately. When the analysis is unavailable the interface says so and does not display the placeholder score.
- No simulated metrics or on-chain activity.

## Tests

```bash
# Backend: security, isolation, policy engine (no PostgreSQL needed; uses in-memory SQLite)
cd backend && python -m pytest

# AI Engine
cd ai-engine && python -m pytest

# Frontend
cd frontend && npm install && npm test
```

Create a virtual environment and install each service's `requirements.txt` first.

## Current Scope and Limitations

- Sentinel evaluates and records operations. The backend does not sign or execute transactions.
- The NEAR vault enforces limits on-chain for native NEAR on testnet only. The demo script connects both layers; the backend does not call the contract yet.
- No public agent registration: agents are created by an administrator.
- Gemini analysis has no transaction history yet, so it always reports limited historical context. It takes a few seconds per request.
- Not a production-grade deployment: no rate limiting, no key-management infrastructure, no idempotency keys.

## Roadmap

Done:

- [x] Agent-specific API authentication, key rotation and revocation
- [x] Individual policy ownership and isolation
- [x] Deterministic Policy Engine
- [x] Operation persistence with PostgreSQL and Alembic migrations
- [x] Gemini advisory analysis with guardrails and fallback
- [x] Internal backend-to-AI authentication
- [x] Frontend integration
- [x] Rust vault on NEAR testnet with on-chain spending limits

Next, in the order we would tackle them:

- [ ] Admin console (or an admin-key protected endpoint) to create agents and rotate keys from the UI
- [ ] Backend-to-vault integration: the API calls `request_transfer` after approving an operation
- [ ] Transaction history for Gemini (average amount, new recipient, recent activity)
- [ ] Rate limiting and lockout on API key authentication
- [ ] Idempotency keys for `POST /operations/evaluate`
- [ ] Separate vault owner account; NEAR function-call keys for the agent process
- [ ] Fungible tokens (NEP-141) and multi-network support
- [ ] Daily spending limit per policy in the API
- [ ] On-chain audit anchor: store a hash of each approved decision
- [ ] Agent reputation and scam-recipient detection
- [ ] TEE attestation for the AI Engine
- [ ] Monitoring and security observability

## Team

| Name | Role |
|---|---|
| Geraldin Nuñez | Frontend |
| Roberto Vasquez | Frontend |
| Franco Mendoza | AI, Backend and Frontend support |
| Jesús Alfaro | Team lead, Blockchain, Backend |

## Hackathon Track

**AI Security & Defense: Trust, but verify.**

Sentinel shows how an AI agent can be given money without being given the keys to everything: independent authentication, isolated permissions, deterministic policy enforcement, AI-assisted risk analysis that never makes the decision, and spending limits enforced on-chain.

## License

Not specified yet.
