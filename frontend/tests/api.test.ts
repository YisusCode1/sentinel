import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, apiRequest, getApiKey, hasApiKey, setApiKey } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setApiKey(null);
});

test("evaluation sends exact decimal strings and injects X-API-Key when configured", async () => {
  let requestBody = "";
  setApiKey("sntl_test_key_abc123");
  assert.equal(hasApiKey(), true);
  assert.equal(getApiKey(), "sntl_test_key_abc123");

  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "http://localhost:8001/api/v1/operations/evaluate");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("X-API-Key"), "sntl_test_key_abc123");
    assert.equal(headers.get("Idempotency-Key"), null, "Idempotency-Key must not be sent");
    assert.equal(headers.get("Content-Type"), "application/json");
    requestBody = String(options?.body);
    return Response.json({ operation_id: "op-1", decision: "rejected", reason: "Excede límite", policy_id: "pol-1" });
  };
  const body = JSON.stringify({ amount: "100.000000000000000000000001" });
  assert.deepEqual(await apiRequest("/operations/evaluate", { method: "POST", body }), {
    operation_id: "op-1",
    decision: "rejected",
    reason: "Excede límite",
    policy_id: "pol-1",
  });
  assert.equal(requestBody, body);
});

test("validation errors expose fields instead of displaying an object", async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "amount"], msg: "Monto inválido" }] }, { status: 422 });
  await assert.rejects(apiRequest("/operations/evaluate"), (error) => error instanceof ApiError && error.status === 422 && error.message === "amount: Monto inválido");
});

test("401 unauthorized returns explicit security error message", async () => {
  globalThis.fetch = async () => Response.json({ detail: "Invalid or inactive API key" }, { status: 401 });
  await assert.rejects(
    apiRequest("/operations"),
    (error) => error instanceof ApiError && error.status === 401 && error.message === "Invalid or inactive API key"
  );
});

test("network and server failures cannot appear as successful evaluations", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(apiRequest("/operations"), (error) => error instanceof ApiError && error.status === 0);
  globalThis.fetch = async () => new Response("Server error", { status: 500 });
  await assert.rejects(apiRequest("/operations"), (error) => error instanceof ApiError && error.status === 500);
});

test("non-JSON success responses are rejected", async () => {
  globalThis.fetch = async () => new Response("<html>Wrong service</html>", { status: 200 });
  await assert.rejects(apiRequest("/operations"), /respuesta vacía o inválida/);
});

test("cancelled history requests preserve the abort error for stale-request handling", async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, options) => { options?.signal?.throwIfAborted(); return Response.json({}); };
  await assert.rejects(apiRequest("/operations", { signal: controller.signal }), { name: "AbortError" });
});
