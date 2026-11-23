import { getOdooConfig } from "./config";
import { OdooAuthError, OdooConnectionError, OdooRpcError } from "./errors";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  OdooRawSessionInfo,
  OdooSessionUser,
  OdooVersionInfo,
} from "./types";

export interface OdooRpcOptions {
  sessionId?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface OdooRpcCallResult<T> {
  result: T;
  sessionId: string | null;
}

export function extractSessionIdFromHeaders(headers: Headers): string | null {
  const cookieHeaders: string[] = [];

  if (typeof headers.getSetCookie === "function") {
    cookieHeaders.push(...headers.getSetCookie());
  }

  if (cookieHeaders.length === 0) {
    const combined = headers.get("set-cookie");
    if (combined) {
      cookieHeaders.push(combined);
    }
  }

  for (const header of cookieHeaders) {
    const match = header.match(/(?:^|,\s*|;\s*)session_id=([^;,\s]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function normalizeSessionUser(raw: OdooRawSessionInfo | null | undefined): OdooSessionUser | null {
  if (!raw || typeof raw.uid !== "number" || raw.uid <= 0) {
    return null;
  }

  const companyId =
    typeof raw.user_companies?.current_company === "number"
      ? raw.user_companies.current_company
      : typeof raw.company_id === "number"
        ? raw.company_id
        : null;

  return {
    uid: raw.uid,
    name: raw.name || raw.username || `User #${raw.uid}`,
    username: raw.username || "",
    db: raw.db || getOdooConfig().db,
    partnerId: typeof raw.partner_id === "number" ? raw.partner_id : null,
    companyId,
    serverVersion: raw.server_version ?? null,
    isAdmin: Boolean(raw.is_admin),
    isSystem: Boolean(raw.is_system),
  };
}

function generateRpcId(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

/**
 * Low-level JSON-RPC 2.0 transport to Odoo's native web endpoints.
 */
export async function odooRpc<TResult>(
  endpoint: string,
  params: Record<string, unknown> = {},
  options: OdooRpcOptions = {}
): Promise<OdooRpcCallResult<TResult>> {
  const config = getOdooConfig();
  const baseUrl = (options.baseUrl ?? config.baseUrl).replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const fetchFn = options.fetchImpl ?? fetch;

  const payload: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "call",
    params,
    id: generateRpcId(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (options.sessionId) {
    headers.Cookie = `session_id=${options.sessionId}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OdooConnectionError(
        `Request to Odoo timed out after ${timeoutMs}ms (${normalizedEndpoint})`,
        error
      );
    }
    throw new OdooConnectionError(
      `Unable to reach Odoo at ${baseUrl}. Ensure Odoo is running and ODOO_BASE_URL is configured.`,
      error
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new OdooConnectionError(
      `Odoo returned HTTP ${response.status} (${response.statusText}) for ${normalizedEndpoint}`
    );
  }

  let data: JsonRpcResponse<TResult>;
  try {
    data = (await response.json()) as JsonRpcResponse<TResult>;
  } catch (error) {
    throw new OdooConnectionError(
      `Odoo returned a non-JSON response for ${normalizedEndpoint}`,
      error
    );
  }

  if (data.error) {
    throw new OdooRpcError(data.error);
  }

  return {
    result: data.result as TResult,
    sessionId: extractSessionIdFromHeaders(response.headers),
  };
}

const SAFE_MODEL_RE = /^[a-z0-9_.]+$/i;
const SAFE_METHOD_RE = /^[a-z0-9_]+$/i;

/**
 * Typed wrapper around Odoo's `/web/dataset/call_kw` endpoint.
 */
export async function odooCall<TResult>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
  options: OdooRpcOptions = {}
): Promise<TResult> {
  if (!SAFE_MODEL_RE.test(model)) {
    throw new Error(`Invalid Odoo model name: "${model}"`);
  }
  if (!SAFE_METHOD_RE.test(method)) {
    throw new Error(`Invalid Odoo method name: "${method}"`);
  }

  const { result } = await odooRpc<TResult>(
    `/web/dataset/call_kw/${model}/${method}`,
    {
      model,
      method,
      args,
      kwargs,
    },
    options
  );

  return result;
}

export async function odooAuthenticate(
  credentials: { login: string; password: string; db?: string },
  options: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<{ user: OdooSessionUser; sessionId: string }> {
  const config = getOdooConfig();
  const db = credentials.db?.trim() || config.db;

  const { result, sessionId } = await odooRpc<OdooRawSessionInfo>(
    "/web/session/authenticate",
    {
      db,
      login: credentials.login,
      password: credentials.password,
    },
    options
  );

  const user = normalizeSessionUser(result);
  if (!user) {
    throw new OdooAuthError("Invalid Odoo username, password, or database.");
  }

  if (!sessionId) {
    throw new OdooAuthError(
      "Odoo authenticated the user but did not return a session_id cookie."
    );
  }

  return { user, sessionId };
}

export async function odooGetSessionInfo(
  sessionId: string,
  options: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<OdooSessionUser | null> {
  try {
    const { result } = await odooRpc<OdooRawSessionInfo>(
      "/web/session/get_session_info",
      {},
      { ...options, sessionId }
    );
    return normalizeSessionUser(result);
  } catch (error) {
    if (error instanceof OdooRpcError && error.statusCode === 401) {
      return null;
    }
    throw error;
  }
}

export async function odooDestroySession(
  sessionId: string,
  options: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<void> {
  try {
    await odooRpc("/web/session/destroy", {}, { ...options, sessionId });
  } catch {
    // Ignore errors when destroying an already-expired Odoo session.
  }
}

export async function odooGetVersionInfo(
  options: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<OdooVersionInfo> {
  const { result } = await odooRpc<OdooVersionInfo>(
    "/web/webclient/version_info",
    {},
    options
  );
  return result;
}
