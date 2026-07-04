import { appConfig } from "@/lib/config";
import { readToken } from "@/lib/auth-storage";

type RequestOptions = {
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined | null | string[]>;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${appConfig.apiUrl}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || "Respuesta invalida del servidor." };
  }
  const message = data && typeof data === "object" && "message" in data ? String(data.message) : "Error de API";
  if (!response.ok) {
    throw new ApiError(message, response.status, data);
  }
  return data as T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const token = options?.token ?? readToken();
  const headers = new Headers();
  if (!(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options?.query), {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError(
      "No se pudo conectar con el backend. Revisá que el servidor esté iniciado y volvé a intentar.",
      0,
      error,
    );
  }
  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
