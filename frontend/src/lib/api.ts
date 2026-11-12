export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8001").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Almacenamiento seguro en memoria para la clave de API activa.
 * Prohibido almacenar en localStorage, sessionStorage o código estático.
 */
let inMemoryApiKey: string | null = null;

export function setApiKey(key: string | null): void {
  inMemoryApiKey = key ? key.trim() : null;
}

export function getApiKey(): string | null {
  return inMemoryApiKey;
}

export function hasApiKey(): boolean {
  return Boolean(inMemoryApiKey && inMemoryApiKey.length > 0);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  const authHeaders: Record<string, string> = inMemoryApiKey
    ? { "X-API-Key": inMemoryApiKey }
    : {};

  const headers: HeadersInit = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...options,
      headers,
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      timeout.aborted
        ? "El servidor tardó demasiado. Comprueba el estado del backend o reintenta la solicitud."
        : "No se pudo conectar con el servidor. Comprueba que el backend esté disponible.",
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      const detail = data?.detail;
      const message = typeof detail === "string"
        ? detail
        : "No autorizado: API Key no proporcionada, inactiva o inválida (X-API-Key).";
      throw new ApiError(message, 401);
    }

    if (response.status === 404) {
      const detail = data?.detail;
      const message = typeof detail === "string" ? detail : "Recurso no encontrado.";
      throw new ApiError(message, 404);
    }

    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail
            .map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join(".") || "Campo"}: ${item.msg || "Valor inválido"}`)
            .join(" · ")
        : response.status >= 500
        ? "El servidor no pudo completar la solicitud. Inténtalo nuevamente."
        : `No se pudo completar la solicitud (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  if (data === null) {
    throw new ApiError("El servidor devolvió una respuesta vacía o inválida.", response.status);
  }

  return data as T;
}
