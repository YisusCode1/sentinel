import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, apiRequest } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("evaluation sends exact decimal strings and an idempotency key", async () => {
  let requestBody = "";
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "http://localhost:8001/api/v1/operations/evaluate");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("Idempotency-Key"), "test-key");
    assert.equal(headers.get("Content-Type"), "application/json");
    requestBody = String(options?.body);
    return Response.json({ decision: "rejected" });
  };
  const body = JSON.stringify({ amount: "100.000000000000000000000001" });
  assert.deepEqual(await apiRequest("/operations/evaluate", { method: "POST", body, headers: { "Idempotency-Key": "test-key" } }), { decision: "rejected" });
  assert.equal(requestBody, body);
});

test("validation errors expose fields instead of displaying an object", async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "amount"], msg: "Monto inválido" }] }, { status: 422 });
  await assert.rejects(apiRequest("/operations/evaluate"), (error) => error instanceof ApiError && error.status === 422 && error.message === "amount: Monto inválido");
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
