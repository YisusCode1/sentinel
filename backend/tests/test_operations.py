import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.main import create_app


class OperationsApiTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.url = f"sqlite:///{(Path(self.directory.name) / 'test.db').as_posix()}"
        self.client = self.enterContext(TestClient(create_app(self.url)))
        response = self.client.post("/api/v1/policies", json={
            "name": "Tesorería", "max_amount": "100", "allowed_tokens": ["USDC"],
            "allowed_recipients": ["treasury.testnet"], "allowed_operations": ["transfer"],
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.policy = response.json()
        self.operation = {"agent_id": "agent-test", "policy_id": self.policy["id"], "network": "near-testnet", "operation": "transfer", "token": "USDC", "amount": "40", "recipient": "treasury.testnet"}

    def evaluate(self, **changes):
        response = self.client.post("/api/v1/operations/evaluate", json=self.operation | changes)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_within_limit_approved_and_persisted(self):
        record = self.evaluate()
        self.assertEqual(record["decision"], "approved")
        self.assertTrue(all(check["passed"] for check in record["checks"]))
        self.assertEqual(record["policy_snapshot"], self.policy)
        self.assertIsNone(record["risk_score"])
        self.assertIsNone(record["requires_signature"])
        self.assertEqual(record["verification_status"], "not_performed")
        self.assertEqual(record["execution_status"], "not_submitted")
        self.assertEqual(self.client.get(f'/api/v1/operations/{record["operation_id"]}').json(), record)

    def test_exact_decimal_boundary(self):
        self.assertEqual(self.evaluate(amount="100.000000000000000000000000")["decision"], "approved")
        self.assertEqual(self.evaluate(amount="100.000000000000000000000001")["decision"], "rejected")

    def test_each_policy_condition_rejects_independently(self):
        for field, value, code in [("amount", "101", "amount"), ("token", "usdc", "token"), ("recipient", "other.testnet", "recipient"), ("operation", "swap", "operation")]:
            with self.subTest(field=field):
                record = self.evaluate(**{field: value})
                self.assertEqual(record["decision"], "rejected")
                self.assertEqual([check["code"] for check in record["checks"] if not check["passed"]], [code])

    def test_all_failures_are_reported(self):
        record = self.evaluate(amount="101", token="NEAR", recipient="other.testnet", operation="stake")
        self.assertTrue(all(not check["passed"] for check in record["checks"]))

    def test_invalid_amounts_are_not_recorded(self):
        for amount in ["0", "0.000", "-1", "NaN", "Infinity", "1e3", "1,000", "1.2.3", "", "9" * 31, "0." + "1" * 25, 40]:
            with self.subTest(amount=amount):
                self.assertEqual(self.client.post("/api/v1/operations/evaluate", json=self.operation | {"amount": amount}).status_code, 422)
        self.assertEqual(self.client.get("/api/v1/operations").json()["total"], 0)

    def test_missing_policy_unknown_ids_and_network(self):
        self.assertEqual(self.client.post("/api/v1/operations/evaluate", json=self.operation | {"policy_id": "missing"}).status_code, 404)
        self.assertEqual(self.client.post("/api/v1/operations/evaluate", json=self.operation | {"network": "near-mainnet"}).status_code, 422)
        self.assertEqual(self.client.get("/api/v1/operations/missing").status_code, 404)
        self.assertEqual(self.client.get("/api/v1/policies/missing").status_code, 404)

    def test_invalid_and_unrecognized_fields_fail_closed(self):
        for change in [{"agent_id": "   "}, {"recipient": ""}, {"risk_score": 0}, {"decision": "approved"}, {"amount": None}]:
            self.assertEqual(self.client.post("/api/v1/operations/evaluate", json=self.operation | change).status_code, 422)
        body = {key: value for key, value in self.policy.items() if key not in ("id", "created_at")}
        for change in [{"allowed_tokens": []}, {"allowed_recipients": [" "]}, {"allowed_operations": []}, {"max_amount": "0"}]:
            self.assertEqual(self.client.post("/api/v1/policies", json=body | change).status_code, 422)

    def test_idempotent_retries_and_conflicting_payload(self):
        headers = {"Idempotency-Key": str(uuid4())}
        first = self.client.post("/api/v1/operations/evaluate", json=self.operation, headers=headers)
        second = self.client.post("/api/v1/operations/evaluate", json=self.operation, headers=headers)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(self.client.get("/api/v1/operations").json()["total"], 1)
        self.assertEqual(self.client.post("/api/v1/operations/evaluate", json=self.operation | {"amount": "50"}, headers=headers).status_code, 409)

    def test_concurrent_retries_create_one_record(self):
        headers = {"Idempotency-Key": str(uuid4())}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post("/api/v1/operations/evaluate", json=self.operation, headers=headers), range(2)))
        self.assertTrue(all(response.status_code == 201 for response in responses))
        self.assertEqual(responses[0].json()["operation_id"], responses[1].json()["operation_id"])
        self.assertEqual(self.client.get("/api/v1/operations").json()["total"], 1)

    def test_history_filter_pagination_summary_and_search(self):
        self.evaluate(agent_id="alpha")
        self.evaluate(agent_id="beta", amount="150")
        latest = self.evaluate(agent_id="gamma")
        first = self.client.get("/api/v1/operations?page_size=2").json()
        self.assertEqual(first["summary"], {"total": 3, "approved": 2, "rejected": 1})
        self.assertEqual(first["items"][0]["operation_id"], latest["operation_id"])
        second = self.client.get("/api/v1/operations?page_size=2&page=2").json()
        self.assertEqual(len(second["items"]), 1)
        self.assertFalse({item["operation_id"] for item in first["items"]} & {item["operation_id"] for item in second["items"]})
        rejected = self.client.get("/api/v1/operations?decision=rejected").json()
        self.assertEqual(rejected["summary"], {"total": 1, "approved": 0, "rejected": 1})
        self.assertEqual(self.client.get("/api/v1/operations?q=ALPHA").json()["total"], 1)
        self.assertEqual(self.client.get("/api/v1/operations", params={"q": "%"}).json()["total"], 0)
        self.assertEqual(self.client.get("/api/v1/operations", params={"q": "' OR 1=1 --"}).json()["total"], 0)

    def test_dates_validation_and_empty_results(self):
        self.evaluate()
        today = datetime.now(timezone.utc).date().isoformat()
        self.assertEqual(self.client.get("/api/v1/operations", params={"date_from": today, "date_to": today}).json()["total"], 1)
        self.assertEqual(self.client.get("/api/v1/operations?date_to=2000-01-01").json()["total"], 0)
        for query in ["page=0", "page_size=101", "decision=unknown", "date_from=2026-01-02&date_to=2026-01-01", "date_to=not-a-date"]:
            self.assertEqual(self.client.get(f"/api/v1/operations?{query}").status_code, 422)

    def test_policies_list_and_retrieve(self):
        self.assertEqual(self.client.get("/api/v1/policies").json(), [self.policy])
        self.assertEqual(self.client.get(f'/api/v1/policies/{self.policy["id"]}').json(), self.policy)

    def test_data_survives_new_application_instance(self):
        record = self.evaluate()
        with TestClient(create_app(self.url)) as other:
            self.assertEqual(other.get("/api/v1/operations").json()["items"][0], record)
            self.assertEqual(other.get("/api/v1/policies").json(), [self.policy])

    def test_cors_for_local_and_docker_frontend(self):
        for origin in ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"]:
            response = self.client.options("/api/v1/operations/evaluate", headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,idempotency-key"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], origin)


if __name__ == "__main__":
    unittest.main()
