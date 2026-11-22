import { odooConfigSchema } from "./validation";

export interface OdooConfig {
  baseUrl: string;
  db: string;
  timeoutMs: number;
  sessionCookieName: string;
}

export function getOdooConfig(): OdooConfig {
  const rawBaseUrl = process.env.ODOO_BASE_URL?.trim() || "http://localhost:8069";
  const db = process.env.ODOO_DB?.trim() || "odoo";
  const rawTimeout = process.env.ODOO_TIMEOUT_MS?.trim();
  const parsedTimeout = rawTimeout ? Number(rawTimeout) : 15_000;
  const sessionCookieName =
    process.env.ODOO_SESSION_COOKIE_NAME?.trim() || "odoo_session_id";

  const parsed = odooConfigSchema.safeParse({
    baseUrl: rawBaseUrl,
    db,
    timeoutMs: parsedTimeout,
    sessionCookieName,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid Odoo configuration: ${details}`);
  }

  return parsed.data;
}
