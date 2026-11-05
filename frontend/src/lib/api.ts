export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8001").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(timeout.aborted
      ? "El servidor tardó demasiado. Actualiza el historial para comprobar el resultado o reintenta el mismo envío."
      : "No se pudo conectar con el servidor. Comprueba que el backend esté disponible.", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join(".") || "Campo"}: ${item.msg || "Valor inválido"}`).join(" · ")
      : response.status >= 500 ? "El servidor no pudo completar la solicitud. Inténtalo nuevamente." : `No se pudo completar la solicitud (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  if (data === null) throw new ApiError("El servidor devolvió una respuesta vacía o inválida.", response.status);
  return data as T;
}
