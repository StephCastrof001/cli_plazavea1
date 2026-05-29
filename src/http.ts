import { BASE_URL, DEFAULT_HEADERS } from "./constants.js";
import { getConfig } from "./config.js";

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

function parseErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    if (typeof json["message"] === "string") return json["message"];
    if (typeof json["error"] === "string") return json["error"];
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

  const response = await fetch(url, { ...options, headers }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(`Network error: ${msg}`);
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const expired = isExpiredStatus(response.status);
    const message = expired
      ? "Sesión VTEX caducada. Ejecuta: plaza login"
      : parseErrorBody(body) || `HTTP ${response.status}`;
    throw new AppError(message, response.status, expired);
  }

  return response.json() as Promise<T>;
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
};
