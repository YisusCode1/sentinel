
# Sentinel AI Engine

AI-powered security analysis component for Sentinel.

## Purpose

Analyze blockchain operations and identify potential risks
before they reach Sentinel's deterministic policy engine.

## Architecture

- main.py: FastAPI service.
- analyzer.py: Risk analysis implementation.
- prompts.py: AI system instructions.
- schemas.py: Input and output contracts.

## Current status

The service currently uses a mock analyzer.

Gemini integration is pending.

## Run locally

From the ai-engine directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

## Endpoints

GET /health

POST /analyze

## Risk output

- LOW
- MEDIUM
- HIGH

Recommendations:

- ALLOW
- REVIEW
- BLOCK

## Security boundary

The AI Engine provides advisory risk analysis only.

It must never execute transactions or override
Sentinel's deterministic security policies.

The backend remains responsible for the final
security decision.
