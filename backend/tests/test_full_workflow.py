import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import create_app


class FullWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db_path = Path(self.directory.name) / "test_workflow.db"
        self.url = f"sqlite:///{self.db_path.as_posix()}"
        self.client = self.enterContext(TestClient(create_app(self.url)))

    def test_complete_sentinel_workflow(self):
        # 1. Crear una política con máximo 100, token USDC, operación transfer y destinatario treasury.testnet.
        policy_res = self.client.post("/api/v1/policies", json={
            "name": "Tesorería Institucional",
            "max_amount": "100",
            "allowed_tokens": ["USDC"],
            "allowed_recipients": ["treasury.testnet"],
            "allowed_operations": ["transfer"],
        })
        self.assertEqual(policy_res.status_code, 201)
        policy = policy_res.json()
        policy_id = policy["id"]
        self.assertEqual(policy["max_amount"], "100")
        self.assertIn("USDC", policy["allowed_tokens"])
        self.assertIn("treasury.testnet", policy["allowed_recipients"])
        self.assertIn("transfer", policy["allowed_operations"])

        # 2. Evaluar una operación por 40 que cumpla las condiciones.
        approved_res = self.client.post("/api/v1/operations/evaluate", json={
            "agent_id": "agent-approved-1",
            "policy_id": policy_id,
            "network": "near-testnet",
            "operation": "transfer",
            "token": "USDC",
            "amount": "40",
            "recipient": "treasury.testnet",
        })
        self.assertEqual(approved_res.status_code, 201)
        approved_op = approved_res.json()
        self.assertEqual(approved_op["decision"], "approved")
        self.assertTrue(all(c["passed"] for c in approved_op["checks"]))

        # 3. Evaluar otra por 150 (excede límite de monto).
        rejected_res = self.client.post("/api/v1/operations/evaluate", json={
            "agent_id": "agent-rejected-1",
            "policy_id": policy_id,
            "network": "near-testnet",
            "operation": "transfer",
            "token": "USDC",
            "amount": "150",
            "recipient": "treasury.testnet",
        })
        self.assertEqual(rejected_res.status_code, 201)
        rejected_op = rejected_res.json()
        self.assertEqual(rejected_op["decision"], "rejected")

        # 4. Confirmar que solo la rechazada aparece en Alertas (GET /operations?decision=rejected).
        alerts_res = self.client.get("/api/v1/operations", params={"decision": "rejected"})
        self.assertEqual(alerts_res.status_code, 200)
        alerts_data = alerts_res.json()
        self.assertEqual(alerts_data["total"], 1)
        self.assertEqual(alerts_data["summary"]["rejected"], 1)
        self.assertEqual(alerts_data["summary"]["approved"], 0)
        self.assertEqual(len(alerts_data["items"]), 1)
        self.assertEqual(alerts_data["items"][0]["operation_id"], rejected_op["operation_id"])
        self.assertEqual(alerts_data["items"][0]["amount"], "150")

        # Verificar que el historial global contiene ambas (total = 2, 1 aprobada, 1 rechazada)
        all_ops = self.client.get("/api/v1/operations").json()
        self.assertEqual(all_ops["total"], 2)
        self.assertEqual(all_ops["summary"]["total"], 2)
        self.assertEqual(all_ops["summary"]["approved"], 1)
        self.assertEqual(all_ops["summary"]["rejected"], 1)

        # 5. Abrir su detalle y comprobar el control de monto fallido.
        detail_res = self.client.get(f"/api/v1/operations/{rejected_op['operation_id']}")
        self.assertEqual(detail_res.status_code, 200)
        detail = detail_res.json()
        self.assertEqual(detail["decision"], "rejected")
        amount_check = next(c for c in detail["checks"] if c["code"] == "amount")
        self.assertFalse(amount_check["passed"])
        self.assertEqual(amount_check["detail"], "Monto: 150. Máximo: 100.")

        # Otros controles sí pasaron
        token_check = next(c for c in detail["checks"] if c["code"] == "token")
        self.assertTrue(token_check["passed"])
        recipient_check = next(c for c in detail["checks"] if c["code"] == "recipient")
        self.assertTrue(recipient_check["passed"])

        # 6. Consultar la política aplicada (snapshot vs actual).
        self.assertEqual(detail["policy_snapshot"]["id"], policy_id)
        current_policy_res = self.client.get(f"/api/v1/policies/{policy_id}")
        self.assertEqual(current_policy_res.status_code, 200)
        self.assertEqual(current_policy_res.json()["name"], "Tesorería Institucional")

        # 7. Buscar, filtrar y paginar alertas.
        # Búsqueda por agent_id
        search_res = self.client.get("/api/v1/operations", params={"decision": "rejected", "q": "agent-rejected-1"})
        self.assertEqual(search_res.json()["total"], 1)
        non_matching_search = self.client.get("/api/v1/operations", params={"decision": "rejected", "q": "agent-approved-1"})
        self.assertEqual(non_matching_search.json()["total"], 0)

        # Paginación
        paginated_res = self.client.get("/api/v1/operations", params={"decision": "rejected", "page": 1, "page_size": 1})
        self.assertEqual(len(paginated_res.json()["items"]), 1)
        self.assertEqual(paginated_res.json()["total"], 1)

        # 8. Recargar y verificar que los datos persisten en nueva instancia.
        with TestClient(create_app(self.url)) as new_client:
            persisted_alerts = new_client.get("/api/v1/operations?decision=rejected").json()
            self.assertEqual(persisted_alerts["total"], 1)
            self.assertEqual(persisted_alerts["items"][0]["operation_id"], rejected_op["operation_id"])
            persisted_policies = new_client.get("/api/v1/policies").json()
            self.assertEqual(len(persisted_policies), 1)
            self.assertEqual(persisted_policies[0]["id"], policy_id)


if __name__ == "__main__":
    unittest.main()
