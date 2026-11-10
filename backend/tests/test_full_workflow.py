"""Full end-to-end workflow integration test for Sentinel Secure Backend."""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

os.environ["AI_ENGINE_TIMEOUT"] = "0.1"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.schemas.operation import AIAnalysisResponse
from app.services.agent_service import create_agent


class FullWorkflowTests(unittest.TestCase):
    """Tests the complete end-to-end lifecycle: Agent -> Policy -> Evaluation -> History."""

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test_workflow.db"
        cls.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        cls.TestingSessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=cls.engine,
        )
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()
        cls.temp_dir.cleanup()

    @patch("app.api.v1.operations.evaluate_risk")
    def test_complete_sentinel_workflow(self, mock_evaluate_risk):
        """Simulates full production workflow from agent onboarding to policy auditing."""
        mock_evaluate_risk.return_value = AIAnalysisResponse(
            risk_level="low",
            risk_score=12,
            flags=["verified_treasury"],
            explanation="Compliant transfer with low behavioral variance.",
            evidence=["amount:40.00"],
            analysis_available=True,
            model_used="gemini-2.5-flash",
            latency_ms=95,
        )

        # 1. Onboard Agent via service
        with self.TestingSessionLocal() as session:
            agent = create_agent(session, f"Workflow-Agent-{uuid4().hex[:6]}")
        headers = {"X-API-Key": agent["api_key"]}

        # 2. Agent creates a security policy
        policy_res = self.client.post(
            "/api/v1/policies",
            headers=headers,
            json={
                "name": "Tesorería Institucional",
                "max_amount": "100.00",
                "allowed_tokens": ["USDC"],
                "allowed_recipients": ["treasury.testnet"],
                "allowed_operations": ["transfer"],
            },
        )
        self.assertEqual(policy_res.status_code, 201)
        policy = policy_res.json()
        policy_id = policy["id"]

        # 3. Evaluate compliant operation (amount = 40 <= 100)
        approved_res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=headers,
            json={
                "policy_id": policy_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "40.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(approved_res.status_code, 200)
        approved_op = approved_res.json()
        self.assertEqual(approved_op["decision"], "approved")
        self.assertEqual(approved_op["reason"], "Operation complies with policy")
        self.assertEqual(approved_op["ai_analysis"]["risk_score"], 12)

        # 4. Evaluate non-compliant operation (amount = 150 > 100)
        rejected_res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=headers,
            json={
                "policy_id": policy_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "150.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(rejected_res.status_code, 200)
        rejected_op = rejected_res.json()
        self.assertEqual(rejected_op["decision"], "rejected")
        self.assertEqual(rejected_op["reason"], "Amount exceeds policy limit")

        # 5. Verify audit history contains both operations
        history = self.client.get("/api/v1/operations", headers=headers).json()
        self.assertEqual(len(history), 2)
        decisions = [op["decision"] for op in history]
        self.assertIn("approved", decisions)
        self.assertIn("rejected", decisions)


if __name__ == "__main__":
    unittest.main()
