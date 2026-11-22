export interface OdooConfig {
  baseUrl: string;
  db: string;
  timeoutMs: number;
  sessionCookieName: string;
}

export function getOdooConfig(): OdooConfig {
  const rawBaseUrl = process.env.ODOO_BASE_URL?.trim() || "http://localhost:8069";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const db = process.env.ODOO_DB?.trim() || "odoo";
  const parsedTimeout = Number.parseInt(process.env.ODOO_TIMEOUT_MS ?? "", 10);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15_000;
  const sessionCookieName =
    process.env.ODOO_SESSION_COOKIE_NAME?.trim() || "odoo_session_id";

  return {
    baseUrl,
    db,
    timeoutMs,
    sessionCookieName,
  };
}
