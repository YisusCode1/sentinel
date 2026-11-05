import assert from "node:assert/strict";
import { test } from "node:test";
import { isPositiveAmount, operationQuery, operationsCsv } from "../src/features/operations/utils.ts";
import type { OperationRecord } from "../src/features/operations/types.ts";

test("amount validation preserves tiny and large decimal strings without Number conversion", () => {
  for (const amount of ["0.000000000000000000000001", "999999999999999999999999999999.999999999999999999999999", "100.000000000000000000000001", "40"]) {
    assert.equal(isPositiveAmount(amount), true, amount);
  }
  for (const amount of ["0", "0.000", "-1", "NaN", "Infinity", "1e3", "1,000", "1.2.3", "", "9".repeat(31), "0." + "1".repeat(25)]) {
    assert.equal(isPositiveAmount(amount), false, amount);
  }
});

test("query safely encodes identifiers and excludes empty filters", () => {
  const query = new URLSearchParams(operationQuery({ q: " treasury&decision=approved ", decision: "rejected", date_from: "", date_to: "2026-11-04" }, 2, 25));
  assert.equal(query.get("q"), "treasury&decision=approved");
  assert.equal(query.get("decision"), "rejected");
  assert.equal(query.get("page"), "2");
  assert.equal(query.get("page_size"), "25");
  assert.equal(query.has("date_from"), false);
});

test("CSV preserves quoted text and decimal precision and neutralizes formulas", () => {
  const item = {
    operation_id: "op-test", created_at: "2026-11-04T10:00:00+00:00", agent_id: '=HYPERLINK("bad")',
    policy_name: 'Treasury, "primary"', network: "near-testnet", operation: "transfer", token: "USDC",
    amount: "0.000000000000000000000001", recipient: "+formula", decision: "approved", reason: "Aceptada\nsegún política", risk_score: null,
  } as OperationRecord;
  const csv = operationsCsv([item]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\'+formula"'));
  assert.ok(csv.includes('"Treasury, ""primary"""'));
  assert.ok(csv.includes('"0.000000000000000000000001"'));
  assert.ok(csv.includes('"No disponible"'));
});
