import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import type { Analysis, ChatMessage, ChatReply, Operation, Policy } from './api';
import './App.css';

function Risk({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) return <p className="muted">Sin análisis guardado.</p>;
  return <div className="risk">
    <div className="row"><strong>Riesgo {analysis.risk_score}/100 · {analysis.risk_level}</strong>
      <span className="tag">{analysis.analysis_available ? 'LLM' : analysis.model_used === 'deterministic-demo-v1' ? 'Demostración' : 'IA no disponible'}</span></div>
    <meter min={0} max={100} low={40} high={70} optimum={0} value={analysis.risk_score} aria-label="Puntaje de riesgo" />
    <p>{analysis.explanation}</p>
    <div className="tags">{analysis.flags.map(flag => <span className="tag" key={flag}>{flag}</span>)}</div>
    {analysis.evidence.length > 0 && <details><summary>Evidencias</summary><ul>{analysis.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
  </div>;
}

function App() {
  const [status, setStatus] = useState('Conectando…');
  const [keyInput, setKeyInput] = useState('');
  const [key, setKey] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('40');
  const [token, setToken] = useState('USDC');
  const [recipient, setRecipient] = useState('demo-recipient');
  const [operationType, setOperationType] = useState('transfer');
  const [messages, setMessages] = useState<(ChatMessage & { result?: ChatReply })[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatError, setChatError] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { api<{ status: string }>('/health').then(data => setStatus(data.status)).catch(() => setStatus('Desconectado')); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, chatBusy]);

  async function refresh(apiKey: string) {
    const [p, o] = await Promise.all([api<Policy[]>('/policies', apiKey), api<Operation[]>('/operations', apiKey)]);
    setPolicies(p); setOperations(o);
    return p;
  }
  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const candidate = keyInput.trim();
      const p = await refresh(candidate);
      setKey(candidate); setPolicyId(p[0]?.id || ''); setMessages([]); setSelected(''); setChatError('');
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }
  async function demoPolicy() {
    setBusy(true); setError('');
    try {
      const p = await api<Policy>('/policies', key, { name: 'Política demo USDC', max_amount: '100', allowed_tokens: ['USDC'], allowed_recipients: ['demo-recipient'], allowed_operations: ['transfer'] });
      await refresh(key); setPolicyId(p.id); setToken('USDC'); setRecipient('demo-recipient'); setOperationType('transfer');
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }
  async function evaluate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ operation_id: string }>('/operations/evaluate', key, { policy_id: policyId, network: 'near-testnet', operation: operationType, token, amount, recipient });
      setSelected(result.operation_id); await refresh(key);
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!message.trim() || chatBusy) return;
    const content = message.trim(); setChatBusy(true); setChatError('');
    try {
      const result = await api<ChatReply>('/assistant/chat', key, { message: content, operation_id: selected || null,
        history: messages.slice(-12).map(({ role, content: text }) => ({ role, content: text.slice(0, 2000) })) });
      setMessages(previous => [...previous, { role: 'user', content }, { role: 'assistant', content: result.reply, result }]); setMessage('');
    } catch (err) { setChatError(String(err)); }
    finally { setChatBusy(false); }
  }
  return <main>
    <header><div><p className="eyebrow">CONTROL DE AGENTES · NEAR TESTNET</p><h1>SENTINEL<span> / IA</span></h1></div><span className="tag">Backend: {status}</span></header>
    <p className="intro">Evalúa operaciones, inspecciona riesgos y consulta tus políticas.</p>
    <form className="connection row" onSubmit={connect}>
      <label>API key del agente<input type="password" autoComplete="off" placeholder="Clave generada por la CLI" value={keyInput} onChange={e => setKeyInput(e.target.value)} required /></label>
      <button disabled={busy || chatBusy}>{key ? 'Cambiar agente' : 'Conectar agente'}</button>
      <small>La clave permanece solo en memoria.</small>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="workspace">
      <section className="operations">
        <div className="row"><h2>Operaciones</h2><button className="secondary" disabled={!key || busy} onClick={demoPolicy}>Crear política demo</button></div>
        <p className="muted">La política demo permite transferir hasta 100 USDC a demo-recipient.</p>
        <form onSubmit={evaluate} className="operation-form">
          <label className="wide">Política<select required value={policyId} onChange={e => setPolicyId(e.target.value)}><option value="">Selecciona una política</option>{policies.map(p => <option key={p.id} value={p.id}>{p.name} · límite {p.max_amount}{p.active ? '' : ' · inactiva'}</option>)}</select></label>
          <label>Monto<input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} pattern="[0-9]+([.][0-9]+)?" /></label>
          <label>Token<input required value={token} onChange={e => setToken(e.target.value)} /></label>
          <label>Destinatario<input required value={recipient} onChange={e => setRecipient(e.target.value)} /></label>
          <label>Operación<input required value={operationType} onChange={e => setOperationType(e.target.value)} /></label>
          <button className="wide" disabled={!key || !policyId || busy}>{busy ? 'Procesando…' : 'Evaluar operación'}</button>
        </form>
        <div className="row"><h2>Historial</h2><span className="muted">{operations.length} operaciones</span></div>
        {!operations.length && <p className="empty">Conecta tu agente y evalúa una operación. Prueba 40 USDC y después 150 USDC.</p>}
        <div className="history">{operations.map(op => <article key={op.id} className={selected === op.id ? 'selected' : ''}>
          <div className="row"><strong>{op.amount} {op.token}</strong><span className={`tag ${op.decision}`}>{op.decision === 'approved' ? 'Permitida por política' : 'Rechazada por política'}</span></div>
          <p>{op.reason}</p><small>{op.recipient} · {new Date(op.created_at).toLocaleString()}</small>
          <Risk analysis={op.ai_analysis} />
          <button className="secondary" disabled={chatBusy} onClick={() => { setSelected(op.id); setMessage('Explica la decisión y los riesgos de esta operación.'); }}>Consultar en el asistente</button>
        </article>)}</div>
      </section>
      <aside className="assistant">
        <div className="row"><h2>Asistente de IA</h2><span className="tag">Solo consulta</span></div>
        <p className="muted">Usa tus operaciones recientes y políticas activas. Las sugerencias no modifican reglas.</p>
        <label>Contexto<select disabled={chatBusy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Resumen del agente</option>{operations.map(op => <option key={op.id} value={op.id}>{op.amount} {op.token} · {op.id.slice(0, 8)}</option>)}</select></label>
        <div className="chat" role="log" aria-live="polite" aria-label="Conversación con el asistente">
          {!messages.length && <div className="empty"><strong>Comprende cada decisión</strong><p>Pregunta por qué se rechazó una operación, audita los riesgos o solicita propuestas de políticas.</p></div>}
          {messages.map((item, i) => <div key={i} className={`bubble ${item.role}`}><small>{item.role === 'user' ? 'Tú' : `Sentinel · ${item.result?.mode === 'demo' ? 'Demostración sin LLM' : item.result?.mode === 'unavailable' ? 'No disponible' : 'LLM'}`}</small><p>{item.content}</p>
            {!!item.result?.suggested_rules.length && <><strong>Propuestas para revisión</strong><ul>{item.result.suggested_rules.map((rule, n) => <li key={n}>{rule}</li>)}</ul></>}
            {!!item.result?.warnings.length && <p className="warnings">{item.result.warnings.join(' · ')}</p>}
          </div>)}
          {chatBusy && <p role="status">Consultando el contexto…</p>}<div ref={chatEnd} />
        </div>
        {chatError && <p role="alert" className="error">{chatError}</p>}
        <form onSubmit={send}><label>Tu consulta<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} required placeholder="¿Qué riesgos ves y qué reglas sugieres?" /></label><button disabled={!key || chatBusy || !message.trim()}>{chatBusy ? 'Consultando…' : 'Enviar consulta'}</button></form>
      </aside>
    </div>
    <footer>La IA es consultiva. El motor de políticas determina la decisión; esta interfaz no ejecuta ni verifica transacciones en blockchain.</footer>
  </main>;
}
export default App;
