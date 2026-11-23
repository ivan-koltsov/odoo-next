/**
 * Browser-side API client for calling Next.js BFF routes and Odoo JSON-RPC methods.
 * Mirrors the centralized `odooCall` pattern while keeping Odoo credentials,
 * URLs, and HttpOnly session cookies strictly on the server.
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as
    | ({ error?: string; code?: string } & Record<string, unknown>)
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      data?.error || `Request failed with status ${response.status}`,
      response.status,
      data?.code
    );
  }

  return data as T;
}

export async function odooCall<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  const data = await apiFetch<{ result: T }>("/api/odoo/call", {
    method: "POST",
    body: JSON.stringify({ model, method, args, kwargs }),
  });
  return data.result;
}
