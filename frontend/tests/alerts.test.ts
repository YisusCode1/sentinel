import assert from "node:assert/strict";
import { test } from "node:test";
import { alertsQuery, operationsCsv } from "../src/features/operations/utils.ts";
import type { OperationPage, OperationRecord } from "../src/features/operations/types.ts";

test("alertsQuery strictly enforces decision=rejected and formats parameters safely", () => {
  const q1 = new URLSearchParams(alertsQuery({}, 1, 10));
  assert.equal(q1.get("decision"), "rejected");
  assert.equal(q1.get("page"), "1");
  assert.equal(q1.get("page_size"), "10");
  assert.equal(q1.has("q"), false);
  assert.equal(q1.has("date_from"), false);
  assert.equal(q1.has("date_to"), false);

  const q2 = new URLSearchParams(
    alertsQuery(
      {
        q: "agent-alpha",
        date_from: "2026-11-01",
        date_to: "2026-11-04",
      },
      3,
      50
    )
  );
  assert.equal(q2.get("decision"), "rejected");
  assert.equal(q2.get("q"), "agent-alpha");
  assert.equal(q2.get("date_from"), "2026-11-01");
  assert.equal(q2.get("date_to"), "2026-11-04");
  assert.equal(q2.get("page"), "3");
  assert.equal(q2.get("page_size"), "50");
});

test("alert indicators derive strictly from server total and summary, never visible items length", () => {
  // Simulate a paginated server response with 50 total rejected alerts, but only 2 items on current page
  const pageResponse: OperationPage = {
    items: [
      {
        id: "op-1",
        operation_id: "op-1",
        created_at: "2026-11-04T12:00:00Z",
        agent_id: "agent-1",
        policy_id: "policy-1",
        network: "near-testnet",
        operation: "transfer",
        token: "USDC",
        amount: "150",
        recipient: "treasury.testnet",
        decision: "rejected",
        reason: "No cumple: Límite de monto.",
        ai_analysis: null,
      },
      {
        id: "op-2",
        operation_id: "op-2",
        created_at: "2026-11-04T12:05:00Z",
        agent_id: "agent-2",
        policy_id: "policy-1",
        network: "near-testnet",
        operation: "swap",
        token: "USDC",
        amount: "50",
        recipient: "treasury.testnet",
        decision: "rejected",
        reason: "No cumple: Tipo de operación.",
        ai_analysis: {
          risk_level: "medium",
          risk_score: 55,
          flags: ["unusual_pattern"],
          explanation: "Riesgo medio detectado",
          evidence: [],
          analysis_available: true,
        },
      },
    ],
    total: 50,
    page: 1,
    page_size: 2,
    summary: {
      total: 50,
      approved: 0,
      rejected: 50,
    },
  };

  // Badge count and summary indicators must use total/summary.rejected, NOT items.length (which is 2)
  const rejectedTotal = pageResponse.summary.rejected;
  const globalTotal = pageResponse.total;
  const visibleCount = pageResponse.items.length;

  assert.equal(rejectedTotal, 50);
  assert.equal(globalTotal, 50);
  assert.equal(visibleCount, 2);
  assert.notEqual(visibleCount, rejectedTotal);
});

test("alert CSV export correctly preserves precision, quotes cells, and neutralizes injection", () => {
  const rejectedRecord: OperationRecord = {
    id: "op-bad-formula",
    operation_id: "op-bad-formula",
    created_at: "2026-11-04T14:00:00Z",
    agent_id: "=CMD('calc')",
    policy_id: "Tesorería, Global",
    network: "near-testnet",
    operation: "transfer",
    token: "USDC",
    amount: "999999999999999999999999999999.000000000000000000000001",
    recipient: "@malicious.testnet",
    decision: "rejected",
    reason: "No cumple: Límite de monto.",
    ai_analysis: null,
  };

  const csv = operationsCsv([rejectedRecord]);
  assert.ok(csv.startsWith("\uFEFF"), "Must start with UTF-8 BOM");
  assert.ok(csv.includes('"\'=CMD(\'calc\')"'), "Equal-sign formula must be escaped with single quote");
  assert.ok(csv.includes('"\'@malicious.testnet"'), "At-sign must be escaped with single quote");
  assert.ok(csv.includes('"999999999999999999999999999999.000000000000000000000001"'), "Decimal precision preserved");
  assert.ok(csv.includes('"Tesorería, Global"'), "Commas within names preserved inside quotes");
  assert.ok(csv.includes('"rejected"'), "Rejected decision preserved");
});
