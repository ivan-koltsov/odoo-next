import type { JsonRpcErrorPayload } from "./types";

export class OdooError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly odooErrorName?: string;
  readonly debug?: string;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      odooErrorName?: string;
      debug?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "OdooError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "ODOO_ERROR";
    this.odooErrorName = options.odooErrorName;
    this.debug = options.debug;
  }
}

export class OdooAuthError extends OdooError {
  constructor(message = "Authentication failed. Check your Odoo credentials and database.") {
    super(message, { statusCode: 401, code: "ODOO_AUTH_ERROR" });
    this.name = "OdooAuthError";
  }
}

export class OdooConnectionError extends OdooError {
  constructor(message: string, cause?: unknown) {
    super(message, { statusCode: 503, code: "ODOO_CONNECTION_ERROR", cause });
    this.name = "OdooConnectionError";
  }
}

export class OdooRpcError extends OdooError {
  readonly rpcCode: number;

  constructor(payload: JsonRpcErrorPayload) {
    const odooErrorName = payload.data?.name;
    const message =
      payload.data?.message?.trim() ||
      payload.message?.trim() ||
      "Odoo JSON-RPC call failed";

    const statusCode = mapRpcErrorToHttpStatus(payload.code, odooErrorName);
    const code = mapRpcErrorToCode(payload.code, odooErrorName);

    super(message, {
      statusCode,
      code,
      odooErrorName,
      debug: payload.data?.debug,
    });
    this.name = "OdooRpcError";
    this.rpcCode = payload.code;
  }
}

function mapRpcErrorToHttpStatus(rpcCode: number, odooErrorName?: string): number {
  if (rpcCode === 100 || odooErrorName?.includes("SessionExpiredException")) {
    return 401;
  }
  if (
    odooErrorName?.includes("AccessDenied") ||
    odooErrorName?.includes("AccessError")
  ) {
    return 403;
  }
  if (
    odooErrorName?.includes("ValidationError") ||
    odooErrorName?.includes("UserError") ||
    odooErrorName?.includes("MissingError")
  ) {
    return 400;
  }
  return 502;
}

function mapRpcErrorToCode(rpcCode: number, odooErrorName?: string): string {
  if (rpcCode === 100 || odooErrorName?.includes("SessionExpiredException")) {
    return "ODOO_SESSION_EXPIRED";
  }
  if (
    odooErrorName?.includes("AccessDenied") ||
    odooErrorName?.includes("AccessError")
  ) {
    return "ODOO_ACCESS_DENIED";
  }
  if (
    odooErrorName?.includes("ValidationError") ||
    odooErrorName?.includes("UserError")
  ) {
    return "ODOO_VALIDATION_ERROR";
  }
  return "ODOO_RPC_ERROR";
}

export function isOdooSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof OdooError &&
    (error.statusCode === 401 || error.code === "ODOO_SESSION_EXPIRED")
  );
}

export function toApiErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code: string; odooErrorName?: string };
} {
  if (error instanceof OdooError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        ...(error.odooErrorName ? { odooErrorName: error.odooErrorName } : {}),
      },
    };
  }

  const message =
    error instanceof Error ? error.message : "An unexpected server error occurred";

  return {
    status: 500,
    body: {
      error: message,
      code: "INTERNAL_SERVER_ERROR",
    },
  };
}
