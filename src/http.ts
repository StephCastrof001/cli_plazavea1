import { getConfig } from "./config.js";
import { BASE_URL, DEFAULT_HEADERS } from "./constants.js";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 0,
    public readonly isSessionExpired: boolean = false,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Patrón de resiliencia — recuperado de plazavea-antigravity/src/http.ts
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [500, 1500, 3000] as const;

function parseErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    if (typeof json.message === "string") return json.message;
    if (typeof json.error === "string") return json.error;
  } catch {
    // not JSON
  }
  return body.substring(0, 200);
}

function isExpiredStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function buildHeaders(extra?: Record<string, string>): Headers {
  const config = getConfig();
  const cookieStr = config.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  return new Headers({
    ...DEFAULT_HEADERS,
    ...(cookieStr ? { Cookie: cookieStr } : {}),
    ...(extra ?? {}),
  });
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = buildHeaders(options.headers as Record<string, string> | undefined);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const expired = isExpiredStatus(response.status);
        const message = expired
          ? "Sesión VTEX caducada. Ejecuta: plaza login"
          : parseErrorBody(body) || `HTTP ${response.status}`;
        throw new AppError(message, response.status, expired);
      }

      return response.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;

      // No reintentar en sesión expirada (401/403) ni en timeout propio
      if (err instanceof AppError && err.isSessionExpired) throw err;
      if ((err as Error).name === "AbortError") {
        lastError = new AppError(`Timeout (${TIMEOUT_MS}ms): ${url}`, 0);
        throw lastError; // timeout = no reintentar, falla rápido
      }

      // No reintentar en el último intento
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
    }
  }

  throw lastError ?? new AppError(`Request failed after ${MAX_RETRIES} attempts: ${url}`);
}

export const http = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "GET", headers }),

  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    }),

  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers,
    }),
};
