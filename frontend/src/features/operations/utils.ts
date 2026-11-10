import type { OperationFilters, OperationRecord } from "./types";

export const amountPattern = "[0-9]{1,30}([.][0-9]{1,24})?";
export function isPositiveAmount(value: string): boolean {
  return new RegExp(`^${amountPattern}$`).test(value) && /[1-9]/.test(value);
}

export function operationQuery(filters: OperationFilters, page: number, pageSize: number): string {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) query.set(key, value.trim());
  }
  return query.toString();
}

export function alertsQuery(filters: { q?: string; date_from?: string; date_to?: string }, page: number, pageSize: number): string {
  const query = new URLSearchParams({ decision: "rejected", page: String(page), page_size: String(pageSize) });
  if (filters.q?.trim()) query.set("q", filters.q.trim());
  if (filters.date_from?.trim()) query.set("date_from", filters.date_from.trim());
  if (filters.date_to?.trim()) query.set("date_to", filters.date_to.trim());
  return query.toString();
}

export function displayDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function csvCell(value: string): string {
  // Neutralize spreadsheet formula injection in user-controlled identifiers.
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function operationsCsv(items: OperationRecord[]): string {
  const header = ["ID", "Fecha UTC", "Agente", "ID Política", "Red", "Tipo", "Token", "Monto", "Destinatario", "Decisión", "Motivo", "Riesgo IA"];
  const rows = items.map((item) => [
    item.id || item.operation_id || "",
    item.created_at,
    item.agent_id,
    item.policy_id,
    item.network,
    item.operation,
    item.token,
    item.amount,
    item.recipient,
    item.decision,
    item.reason,
    item.ai_analysis?.risk_score !== undefined
      ? `${item.ai_analysis.risk_score} (${item.ai_analysis.risk_level})`
      : "No disponible",
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    }
    return false;
  } catch {
    return false;
  }
}
