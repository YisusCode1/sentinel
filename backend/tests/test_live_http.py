"""Smoke test with two real Uvicorn processes and an isolated SQLite database."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def test_live_http_roundtrip(tmp_path):
    ai_port, backend_port = free_port(), free_port()
    while backend_port == ai_port:
        backend_port = free_port()
    env = {**os.environ, 'DATABASE_URL': f"sqlite:///{(tmp_path / 'smoke.db').as_posix()}",
           'INTERNAL_SERVICE_KEY': 'isolated-smoke-key', 'GEMINI_API_KEY': '', 'LLM_API_KEY': '',
           'AI_DEMO_FALLBACK': 'true', 'AI_ENGINE_URL': f'http://127.0.0.1:{ai_port}'}
    options = {'env': env, 'capture_output': True, 'text': True, 'check': True, 'timeout': 20}
    subprocess.run([sys.executable, '-m', 'app.init_db'], cwd=ROOT / 'backend', **options)
    seed = subprocess.run([sys.executable, '-c',
        'import json; from app.core.database import SessionLocal; from app.services.agent_service import create_agent; '
        'db = SessionLocal(); print(json.dumps(create_agent(db, "HTTP smoke agent"))); db.close()'],
        cwd=ROOT / 'backend', **options)
    key = json.loads(seed.stdout)['api_key']
    processes = []
    try:
        for folder, port in [('ai-engine', ai_port), ('backend', backend_port)]:
            processes.append(subprocess.Popen(
                [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
                cwd=ROOT / folder, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            ))
        with httpx.Client(timeout=10, trust_env=False) as http:
            for port, route in [(ai_port, '/health'), (backend_port, '/api/v1/health')]:
                deadline = time.monotonic() + 15
                while True:
                    try:
                        response = http.get(f'http://127.0.0.1:{port}{route}')
                        response.raise_for_status()
                        break
                    except httpx.HTTPError:
                        assert time.monotonic() < deadline, 'Local service did not start'
                        time.sleep(.1)
            base = f'http://127.0.0.1:{backend_port}/api/v1'
            headers = {'X-API-Key': key}
            response = http.post(base + '/policies', headers=headers, json={
                'name': 'Smoke policy', 'max_amount': '100', 'allowed_tokens': ['USDC'],
                'allowed_recipients': ['demo-recipient'], 'allowed_operations': ['transfer']})
            response.raise_for_status()
            pid = response.json()['id']
            for amount, expected in [('40', 'approved'), ('150', 'rejected')]:
                response = http.post(base + '/operations/evaluate', headers=headers, json={
                    'policy_id': pid, 'network': 'near-testnet', 'operation': 'transfer',
                    'token': 'USDC', 'amount': amount, 'recipient': 'demo-recipient'})
                response.raise_for_status()
                decision = response.json()
                assert decision['decision'] == expected
                assert decision['ai_analysis']['model_used'] == 'deterministic-demo-v1'
            response = http.post(base + '/assistant/chat', headers=headers,
                                 json={'message': 'Explica la operación y sugiere reglas',
                                       'operation_id': decision['operation_id']})
            response.raise_for_status()
            assert response.json()['mode'] == 'demo'
            assert 'Amount exceeds policy limit' in response.json()['reply']
            assert len(http.get(base + '/operations', headers=headers).json()) == 2
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
