import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
let Button: Awaited<ReturnType<ViteDevServer['ssrLoadModule']>>['default'];
let Card: typeof Button;
let TableSkeleton: typeof Button;
let ResultSkeleton: typeof Button;
let OperationResult: typeof Button;
let ToastProvider: typeof Button;
let Modal: typeof Button;

// Render the actual TSX through the project's Vite pipeline, without a browser
// or a listening HTTP server. These checks cover semantics, not visual effects.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null } });
  ({ default: Button } = await server.ssrLoadModule('/src/components/ui/Button.tsx'));
  ({ default: Card } = await server.ssrLoadModule('/src/components/ui/Card.tsx'));
  ({ TableSkeleton, ResultSkeleton } = await server.ssrLoadModule('/src/components/ui/Skeleton.tsx'));
  ({ default: OperationResult } = await server.ssrLoadModule('/src/features/operations/OperationResult.tsx'));
  ({ ToastProvider } = await server.ssrLoadModule('/src/components/ui/ToastProvider.tsx'));
  ({ default: Modal } = await server.ssrLoadModule('/src/components/ui/Modal.tsx'));
});

const record = {
  operation_id: 'op-test', agent_id: 'agent.testnet', policy_id: 'policy-test',
  network: 'near-testnet', operation: 'transfer', token: 'USDC', amount: '42', recipient: 'treasury.testnet',
  created_at: '2026-11-06T12:00:00Z', decision: 'approved', reason: 'Dentro de los limites', policy_name: 'Treasury',
  policy_snapshot: { id: 'policy-test', name: 'Treasury', max_amount: '100', allowed_tokens: ['USDC'], allowed_operations: ['transfer'], allowed_recipients: ['treasury.testnet'], created_at: '2026-11-06T12:00:00Z' },
  checks: [], risk_score: null, risk_analysis_status: 'unavailable', requires_signature: null,
  verification_status: 'not_performed', execution_status: 'not_submitted',
};

test('Pending and failed results never display a previous approval', () => {
  const pending = renderToStaticMarkup(createElement(OperationResult, { record, pending: true, error: '' }));
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /ui-skeleton-result/);
  assert.doesNotMatch(pending, /Aprobada por pol/);
  const failed = renderToStaticMarkup(createElement(OperationResult, { record, pending: false, error: 'Servidor inaccesible' }));
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Servidor inaccesible/);
  assert.doesNotMatch(failed, /Aprobada por pol|ui-skeleton-result/);
});

test('Results keep rejected decisions distinct and use unique accessible headings', () => {
  const html = renderToStaticMarkup(createElement(ToastProvider, null,
    createElement(OperationResult, { record: { ...record, decision: 'rejected' }, pending: false, error: '' }),
    createElement(OperationResult, { record, pending: false, error: '' }),
  ));
  assert.match(html, /Rechazada por pol/);
  assert.match(html, /verification|Verificaci/);
  const headingIds = [...html.matchAll(/<h3 id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(headingIds.length, 2);
  assert.equal(new Set(headingIds).size, 2);
  for (const id of headingIds) assert.ok(html.includes(`aria-labelledby="${id}"`));
});

test('Policy dialog has a labelled native focus boundary; notifications have a stable live region', () => {
  const html = renderToStaticMarkup(createElement(ToastProvider, null,
    createElement(Modal, { labelledBy: 'test-title', onClose: () => {} }, createElement('h2', { id: 'test-title' }, 'Politica')),
  ));
  assert.match(html, /<dialog[^>]*aria-labelledby="test-title"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /aria-label="Notificaciones"/);
});

after(async () => { await server?.close(); });

test('Button is safe inside forms by default and preserves explicit submit semantics', () => {
  const defaultButton = renderToStaticMarkup(createElement(Button, null, 'Abrir'));
  assert.match(defaultButton, /type="button"/);
  assert.doesNotMatch(defaultButton, /disabled=""/);
  const submitButton = renderToStaticMarkup(createElement(Button, { type: 'submit', name: 'action', value: 'evaluate' }, 'Evaluar'));
  assert.match(submitButton, /type="submit"/);
  assert.match(submitButton, /name="action"/);
  assert.match(submitButton, /value="evaluate"/);
});

test('Loading Button disables native submission and communicates the pending action', () => {
  const html = renderToStaticMarkup(createElement(Button, { type: 'submit', loading: true, loadingLabel: 'Evaluando', disabled: false }, 'Evaluar'));
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, />Evaluando<|Evaluando<\/button>/);
  assert.match(html, /aria-hidden="true"/);
  const disabledButton = renderToStaticMarkup(createElement(Button, { loading: false, disabled: true }, 'Evaluar'));
  assert.match(disabledButton, /disabled=""/);
});

test('Card preserves article semantics and nested controls without an extra tab stop', () => {
  const html = renderToStaticMarkup(createElement(Card, { as: 'article', 'aria-label': 'Metrica' }, createElement('button', { type: 'button' }, 'Detalle')));
  assert.match(html, /^<article/);
  assert.match(html, /aria-label="Metrica"/);
  assert.match(html, /<button type="button">Detalle<\/button>/);
  assert.doesNotMatch(html, /tabindex=|role="button"/);
  const staticCard = renderToStaticMarkup(createElement(Card, { interactive: false }, 'Contenido'));
  assert.doesNotMatch(staticCard, /ui-card-edge|ui-card-light/);
});

test('Skeletons expose one loading message and hide decorative placeholders', () => {
  for (const Component of [TableSkeleton, ResultSkeleton]) {
    const html = renderToStaticMarkup(createElement(Component, { label: 'Consultando servidor' }));
    assert.equal((html.match(/role="status"/g) ?? []).length, 1);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Consultando servidor/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /<button|tabindex=/);
  }
});
