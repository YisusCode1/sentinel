"""Comprehensive integration tests for Sentinel Operation Evaluation and Security Contract."""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

# Set short timeout for unmocked AI engine calls during tests
os.environ["AI_ENGINE_TIMEOUT"] = "0.1"

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.schemas.operation import AIAnalysisResponse
from app.services.agent_service import create_agent


class OperationEvaluationTests(unittest.TestCase):
    """Verifies authentication, authorization isolation, and deterministic policy evaluation."""

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test_operations.db"
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

    def setUp(self):
        # Create test agent A and generate valid API key
        with self.TestingSessionLocal() as session:
            agent_a_data = create_agent(session, f"Agent-Alpha-{uuid4().hex[:6]}")
        self.agent_a_id = agent_a_data["agent_id"]
        self.agent_a_key = agent_a_data["api_key"]
        self.headers_a = {"X-API-Key": self.agent_a_key}

        # Create test policy for Agent A
        policy_res = self.client.post(
            "/api/v1/policies",
            headers=self.headers_a,
            json={
                "name": "Treasury Transfer Policy",
                "max_amount": "100.00",
                "allowed_tokens": ["USDC", "NEAR"],
                "allowed_recipients": ["treasury.testnet", "alice.testnet"],
                "allowed_operations": ["transfer"],
            },
        )
        self.assertEqual(policy_res.status_code, 201)
        self.policy_a = policy_res.json()
        self.policy_a_id = self.policy_a["id"]

    def test_unauthenticated_requests_are_rejected(self):
        """Endpoints must reject requests without X-API-Key."""
        res_eval = self.client.post(
            "/api/v1/operations/evaluate",
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "25.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(res_eval.status_code, 401)

        res_policies = self.client.get("/api/v1/policies")
        self.assertEqual(res_policies.status_code, 401)

        res_history = self.client.get("/api/v1/operations")
        self.assertEqual(res_history.status_code, 401)

    def test_invalid_api_key_is_rejected(self):
        """Endpoints must reject invalid or forged API keys."""
        res = self.client.get(
            "/api/v1/policies",
            headers={"X-API-Key": "sntl_live_invalidkey1234567890abcdef1234567890"},
        )
        self.assertEqual(res.status_code, 401)

    def test_client_cannot_pass_agent_id_in_payload(self):
        """Payloads containing agent_id must be rejected with 422 Unprocessable Entity."""
        res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=self.headers_a,
            json={
                "agent_id": "malicious-agent-id",
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "25.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(res.status_code, 422)

    def test_cross_tenant_policy_isolation(self):
        """Agent B cannot evaluate against or access Agent A's policy."""
        # Create Agent B
        with self.TestingSessionLocal() as session:
            agent_b_data = create_agent(session, f"Agent-Beta-{uuid4().hex[:6]}")
        headers_b = {"X-API-Key": agent_b_data["api_key"]}

        # Attempt to evaluate using Agent A's policy ID
        res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=headers_b,
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "25.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["detail"], "Policy not found")

        # Agent B cannot fetch Agent A's policy
        res_get = self.client.get(f"/api/v1/policies/{self.policy_a_id}", headers=headers_b)
        self.assertEqual(res_get.status_code, 404)

    @patch("app.api.v1.operations.evaluate_risk")
    def test_compliant_operation_approved_with_ai_advisory(self, mock_evaluate_risk):
        """Compliant operation receives 'approved' decision and attaches AI advisory."""
        mock_evaluate_risk.return_value = AIAnalysisResponse(
            risk_level="low",
            risk_score=15,
            flags=["standard_treasury_transfer"],
            explanation="Normal operation within policy parameters and established recipient.",
            evidence=["amount:25.00", "known_recipient:treasury.testnet"],
            analysis_available=True,
            model_used="gemini-2.5-flash",
            latency_ms=120,
        )

        res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=self.headers_a,
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "25.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["decision"], "approved")
        self.assertEqual(data["reason"], "Operation complies with policy")
        self.assertIsNotNone(data["ai_analysis"])
        self.assertEqual(data["ai_analysis"]["risk_score"], 15)
        self.assertEqual(data["ai_analysis"]["risk_level"], "low")

    @patch("app.api.v1.operations.evaluate_risk")
    def test_ai_fallback_unknown_on_ai_failure(self, mock_evaluate_risk):
        """If AI Engine fails, fallback 'unknown' is returned and Policy Engine proceeds."""
        mock_evaluate_risk.return_value = AIAnalysisResponse(
            risk_level="unknown",
            risk_score=50,
            flags=["ai_analysis_unavailable", "fallback_triggered"],
            explanation="AI risk analysis is unavailable. Policy Engine remains authoritative.",
            evidence=["error_type:TimeoutException"],
            analysis_available=False,
            model_used=None,
            latency_ms=None,
        )

        res = self.client.post(
            "/api/v1/operations/evaluate",
            headers=self.headers_a,
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "30.00",
                "recipient": "treasury.testnet",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["decision"], "approved")
        self.assertEqual(data["ai_analysis"]["risk_level"], "unknown")
        self.assertFalse(data["ai_analysis"]["analysis_available"])

    @patch("app.api.v1.operations.evaluate_risk")
    def test_policy_engine_rejections(self, mock_evaluate_risk):
        """Policy Engine must reject each rule violation with exact reason."""
        mock_evaluate_risk.return_value = AIAnalysisResponse(
            risk_level="low",
            risk_score=20,
            flags=[],
            explanation="AI risk analysis completed.",
            evidence=[],
            analysis_available=True,
        )

        cases = [
            (
                {"amount": "150.00"},
                "rejected",
                "Amount exceeds policy limit",
            ),
            (
                {"token": "DAI"},
                "rejected",
                "Token is not allowed",
            ),
            (
                {"recipient": "hacker.testnet"},
                "rejected",
                "Recipient is not allowed",
            ),
            (
                {"operation": "stake"},
                "rejected",
                "Operation type is not allowed",
            ),
        ]

        for overrides, expected_decision, expected_reason in cases:
            with self.subTest(overrides=overrides):
                payload = {
                    "policy_id": self.policy_a_id,
                    "network": "near-testnet",
                    "operation": "transfer",
                    "token": "USDC",
                    "amount": "20.00",
                    "recipient": "treasury.testnet",
                }
                payload.update(overrides)

                res = self.client.post(
                    "/api/v1/operations/evaluate",
                    headers=self.headers_a,
                    json=payload,
                )
                self.assertEqual(res.status_code, 200)
                data = res.json()
                self.assertEqual(data["decision"], expected_decision)
                self.assertEqual(data["reason"], expected_reason)

    @patch("app.api.v1.operations.evaluate_risk")
    def test_audit_history_and_filtering(self, mock_evaluate_risk):
        """Evaluated operations must be stored and filterable by decision."""
        mock_evaluate_risk.return_value = AIAnalysisResponse(
            risk_level="low",
            risk_score=10,
            flags=[],
            explanation="Normal operation.",
            evidence=[],
            analysis_available=True,
        )

        # 1. Execute an approved operation
        self.client.post(
            "/api/v1/operations/evaluate",
            headers=self.headers_a,
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "10.00",
                "recipient": "treasury.testnet",
            },
        )

        # 2. Execute a rejected operation
        res_rej = self.client.post(
            "/api/v1/operations/evaluate",
            headers=self.headers_a,
            json={
                "policy_id": self.policy_a_id,
                "network": "near-testnet",
                "operation": "transfer",
                "token": "USDC",
                "amount": "999.00",
                "recipient": "treasury.testnet",
            },
        )
        rej_id = res_rej.json()["operation_id"]

        # 3. Query all operations
        history_all = self.client.get("/api/v1/operations", headers=self.headers_a).json()
        self.assertGreaterEqual(len(history_all), 2)

        # 4. Query only rejected operations
        history_rejected = self.client.get(
            "/api/v1/operations?decision=rejected",
            headers=self.headers_a,
        ).json()
        self.assertTrue(all(op["decision"] == "rejected" for op in history_rejected))

        # 5. Query single operation by ID
        single_op = self.client.get(
            f"/api/v1/operations/{rej_id}",
            headers=self.headers_a,
        ).json()
        self.assertEqual(single_op["id"], rej_id)
        self.assertEqual(single_op["decision"], "rejected")
        self.assertEqual(single_op["reason"], "Amount exceeds policy limit")


if __name__ == "__main__":
    unittest.main()
