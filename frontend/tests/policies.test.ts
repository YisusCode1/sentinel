import assert from "node:assert/strict";
import { test } from "node:test";
import { isPositiveAmount } from "../src/features/operations/utils.ts";
import type { PolicyRecord } from "../src/features/operations/types.ts";

test("policy max_amount accepts valid positive decimal strings without numeric conversion", () => {
  for (const valid of [
    "0.000000000000000000000001",
    "100",
    "999999999999999999999999999999.999999999999999999999999",
    "0.5",
    "123456789012345678901234567890",
  ]) {
    assert.equal(isPositiveAmount(valid), true, `Expected valid: ${valid}`);
  }

  for (const invalid of [
    "0",
    "0.00",
    "-10",
    "-0.01",
    "1e3",
    "1,000",
    "NaN",
    "Infinity",
    "1.2.3",
    "",
    "   ",
    "9".repeat(31),
    "0." + "1".repeat(25),
  ]) {
    assert.equal(isPositiveAmount(invalid), false, `Expected invalid: ${invalid}`);
  }
});

test("policy list parsing correctly extracts unique trimmed items and preserves casing", () => {
  const parseList = (value: string) => [
    ...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)),
  ];

  const rawTokens = "USDC, near, USDC, NEAR,  token.testnet \n other.testnet  ";
  const parsed = parseList(rawTokens);
  // Casing must be preserved, duplicates removed, trimmed
  assert.deepEqual(parsed, ["USDC", "near", "NEAR", "token.testnet", "other.testnet"]);

  // Empty list detection
  assert.equal(parseList("   , , \n  ").length, 0);
});

test("local policy search filters across name, ID, token, operation, and recipient", () => {
  const samplePolicies: PolicyRecord[] = [
    {
      id: "policy-abc-123",
      created_at: "2026-11-04T12:00:00Z",
      name: "Tesorería Principal",
      max_amount: "5000",
      allowed_tokens: ["USDC", "USDT"],
      allowed_recipients: ["treasury.testnet"],
      allowed_operations: ["transfer"],
    },
    {
      id: "policy-xyz-789",
      created_at: "2026-11-04T12:30:00Z",
      name: "Staking Pool NEAR",
      max_amount: "1000",
      allowed_tokens: ["NEAR"],
      allowed_recipients: ["pool.near"],
      allowed_operations: ["stake", "deposit"],
    },
  ];

  function filterPolicies(list: PolicyRecord[], search: string) {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchTokens = p.allowed_tokens.some((t) => t.toLowerCase().includes(q));
      const matchRecipients = p.allowed_recipients.some((r) => r.toLowerCase().includes(q));
      const matchOps = p.allowed_operations.some((o) => o.toLowerCase().includes(q));
      return matchName || matchId || matchTokens || matchRecipients || matchOps;
    });
  }

  // Filter by name
  assert.equal(filterPolicies(samplePolicies, "tesorería").length, 1);
  assert.equal(filterPolicies(samplePolicies, "tesorería")[0].id, "policy-abc-123");

  // Filter by ID
  assert.equal(filterPolicies(samplePolicies, "xyz-789").length, 1);
  assert.equal(filterPolicies(samplePolicies, "xyz-789")[0].name, "Staking Pool NEAR");

  // Filter by token
  assert.equal(filterPolicies(samplePolicies, "NEAR").length, 1);
  assert.equal(filterPolicies(samplePolicies, "usdt").length, 1);

  // Filter by recipient
  assert.equal(filterPolicies(samplePolicies, "pool.near").length, 1);

  // Filter by operation
  assert.equal(filterPolicies(samplePolicies, "stake").length, 1);

  // Non-matching query
  assert.equal(filterPolicies(samplePolicies, "nonexistent").length, 0);

  // Empty query returns all
  assert.equal(filterPolicies(samplePolicies, "   ").length, 2);
});
