import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useId, useState } from "react";
import { useToast } from '../../components/ui/ToastProvider';
import AnimatedState from '../../components/ui/AnimatedState';
import { Lock, X } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { amountPattern, isPositiveAmount } from "./utils";
import type { PolicyRecord } from "./types";

interface Props {
  onCreated: (policy: PolicyRecord) => void;
  onClose: () => void;
  submitLabel?: string;
  title?: string;
}

export default function PolicyCreator({
  onCreated,
  onClose,
  submitLabel = "Crear política",
  title = "Nueva política de seguridad",
}: Props) {
  const notify = useToast();
  const headingId = useId();
  const [form, setForm] = useState({
    name: "",
    max_amount: "100",
    tokens: "USDC",
    recipients: "",
    operations: "transfer",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    const max_amount = form.max_amount.trim();
    const parseList = (value: string) => [
      ...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)),
    ];
    const allowed_tokens = parseList(form.tokens);
    const allowed_recipients = parseList(form.recipients);
    const allowed_operations = parseList(form.operations);

    if (!name || name.length > 256) {
      setError("El nombre de la política es obligatorio y debe tener entre 1 y 256 caracteres.");
      return;
    }
    if (!isPositiveAmount(max_amount)) {
      setError("El monto máximo debe ser un número decimal positivo mayor que cero (hasta 30 enteros y 24 decimales, con punto decimal, sin comas ni exponentes).");
      return;
    }
    if (!allowed_tokens.length || allowed_tokens.length > 50 || allowed_tokens.some((t) => t.length > 256)) {
      setError("Debes indicar entre 1 y 50 tokens permitidos (máx. 256 caracteres por token). Una lista vacía no significa permitir todo.");
      return;
    }
    if (!allowed_operations.length || allowed_operations.length > 50 || allowed_operations.some((o) => o.length > 256)) {
      setError("Debes indicar entre 1 y 50 tipos de operación autorizados (máx. 256 caracteres por tipo).");
      return;
    }
    if (!allowed_recipients.length || allowed_recipients.length > 50 || allowed_recipients.some((r) => r.length > 256)) {
      setError("Debes indicar entre 1 y 50 destinatarios o contratos autorizados (máx. 256 caracteres por cuenta).");
      return;
    }

    const payload = {
      name,
      max_amount,
      allowed_tokens,
      allowed_recipients,
      allowed_operations,
    };

    setError("");
    setSaving(true);
    try {
      const created = await apiRequest<PolicyRecord>("/policies", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la política en el servidor.");
      notify({ title: 'No se pudo crear la política', description: cause instanceof Error ? cause.message : 'Error de conexión con el servidor.', tone: 'error', key: 'create-policy-error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="card ops-policy-creator" aria-labelledby={headingId}>
      <div className="card-header-row">
        <h3 id={headingId}>
          <Lock size={18} aria-hidden="true" />
          {title}
        </h3>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          disabled={saving}
          aria-label="Cerrar creación de política"
        >
          <X size={18} />
        </button>
      </div>
      <p className="ops-muted">
        Define las reglas de autorización previas a la ejecución. Las listas son exactas y distinguen mayúsculas y minúsculas.
      </p>
      <form onSubmit={submit}>
        <fieldset className="ops-form-grid" disabled={saving}>
          <label className="ops-field">
            Nombre de la política
            <input
              required
              maxLength={256}
              value={form.name}
              placeholder="p. ej. Transferencias de tesorería"
              onChange={(e) => setField("name", e.target.value)}
            />
          </label>
          <label className="ops-field">
            Monto máximo por operación
            <input
              required
              inputMode="decimal"
              pattern={amountPattern}
              maxLength={55}
              value={form.max_amount}
              onChange={(e) => setField("max_amount", e.target.value)}
            />
            <small>Expresado en unidades del token solicitado. No implica conversión de moneda.</small>
          </label>
          <label className="ops-field">
            Tokens permitidos
            <input
              required
              value={form.tokens}
              placeholder="USDC, NEAR, USDT"
              onChange={(e) => setField("tokens", e.target.value)}
            />
            <small>Separa los tokens con comas (1 a 50 valores, p. ej. USDC, NEAR).</small>
          </label>
          <label className="ops-field">
            Tipos de operación autorizados
            <input
              required
              value={form.operations}
              placeholder="transfer, swap, stake"
              onChange={(e) => setField("operations", e.target.value)}
            />
            <small>Separa los tipos con comas (1 a 50 valores, p. ej. transfer, swap).</small>
          </label>
          <label className="ops-field ops-span-full">
            Destinatarios autorizados
            <textarea
              required
              className="contract-address"
              rows={2}
              placeholder="treasury.testnet, supplier.testnet"
              value={form.recipients}
              onChange={(e) => setField("recipients", e.target.value)}
            />
            <small>Cuentas o contratos autorizados. Separa con comas o saltos de línea (1 a 50 valores).</small>
          </label>
        </fieldset>
        <AnimatedState stateKey={error ? 'error' : 'idle'}>{error && (
          <p className="ops-message error" role="alert">
            {error}
          </p>
        )}</AnimatedState>
        <div className="ops-form-actions">
          <Button variant="secondary"
            type="button"

            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button variant="primary" type="submit" loading={saving} loadingLabel="Guardando en servidor…">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
