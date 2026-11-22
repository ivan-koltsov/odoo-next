import { afterEach, describe, expect, it } from "vitest";
import { getOdooConfig } from "@/lib/odoo/config";
import {
  OdooAuthError,
  OdooConnectionError,
  OdooError,
  OdooRpcError,
  isOdooSessionExpiredError,
  toApiErrorResponse,
} from "@/lib/odoo/errors";

const ORIGINAL_ENV = {
  ODOO_BASE_URL: process.env.ODOO_BASE_URL,
  ODOO_DB: process.env.ODOO_DB,
  ODOO_TIMEOUT_MS: process.env.ODOO_TIMEOUT_MS,
  ODOO_SESSION_COOKIE_NAME: process.env.ODOO_SESSION_COOKIE_NAME,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getOdooConfig", () => {
  it("returns sensible defaults when env vars are unset", () => {
    delete process.env.ODOO_BASE_URL;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_TIMEOUT_MS;
    delete process.env.ODOO_SESSION_COOKIE_NAME;

    expect(getOdooConfig()).toEqual({
      baseUrl: "http://localhost:8069",
      db: "odoo",
      timeoutMs: 15_000,
      sessionCookieName: "odoo_session_id",
    });
  });

  it("reads and normalizes custom environment variables", () => {
    process.env.ODOO_BASE_URL = "https://erp.company.test///";
    process.env.ODOO_DB = "company_prod";
    process.env.ODOO_TIMEOUT_MS = "8000";
    process.env.ODOO_SESSION_COOKIE_NAME = "custom_sid";

    expect(getOdooConfig()).toEqual({
      baseUrl: "https://erp.company.test",
      db: "company_prod",
      timeoutMs: 8000,
      sessionCookieName: "custom_sid",
    });
  });

  it("throws a clear error on invalid ODOO_BASE_URL or ODOO_TIMEOUT_MS", () => {
    process.env.ODOO_BASE_URL = "ftp://invalid.host";
    expect(() => getOdooConfig()).toThrow(/Invalid Odoo configuration/);

    process.env.ODOO_BASE_URL = "http://localhost:8069";
    process.env.ODOO_TIMEOUT_MS = "not-a-number";
    expect(() => getOdooConfig()).toThrow(/Invalid Odoo configuration/);
  });
});

describe("Odoo error hierarchy and HTTP mapping", () => {
  it("maps AccessError and AccessDenied to 403", () => {
    const err = new OdooRpcError({
      code: 200,
      message: "Odoo Server Error",
      data: {
        name: "odoo.exceptions.AccessError",
        message: "You are not allowed to access this record.",
      },
    });

    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("ODOO_ACCESS_DENIED");
    expect(isOdooSessionExpiredError(err)).toBe(false);
  });

  it("maps ValidationError, UserError, and MissingError to 400", () => {
    const validationErr = new OdooRpcError({
      code: 200,
      message: "Odoo Server Error",
      data: {
        name: "odoo.exceptions.ValidationError",
        message: "Email must be unique.",
      },
    });
    expect(validationErr.statusCode).toBe(400);
    expect(validationErr.code).toBe("ODOO_VALIDATION_ERROR");

    const missingErr = new OdooRpcError({
      code: 200,
      message: "Odoo Server Error",
      data: {
        name: "odoo.exceptions.MissingError",
        message: "Record does not exist.",
      },
    });
    expect(missingErr.statusCode).toBe(400);
  });

  it("maps unknown RPC errors to 502 and falls back to top-level message", () => {
    const err = new OdooRpcError({
      code: 200,
      message: "Unexpected failure",
      data: { name: "builtins.RuntimeError" },
    });

    expect(err.statusCode).toBe(502);
    expect(err.code).toBe("ODOO_RPC_ERROR");
    expect(err.message).toBe("Unexpected failure");
  });

  it("detects session expiry on 401 OdooAuthError and SessionExpiredException", () => {
    expect(isOdooSessionExpiredError(new OdooAuthError())).toBe(true);
    expect(isOdooSessionExpiredError(new OdooConnectionError("offline"))).toBe(false);
    expect(isOdooSessionExpiredError(new Error("generic"))).toBe(false);
  });

  it("converts OdooError, generic Error, and unknown throwables via toApiErrorResponse", () => {
    const rpcErr = new OdooRpcError({
      code: 200,
      message: "Error",
      data: { name: "odoo.exceptions.UserError", message: "Invalid state" },
    });
    expect(toApiErrorResponse(rpcErr)).toEqual({
      status: 400,
      body: {
        error: "Invalid state",
        code: "ODOO_VALIDATION_ERROR",
        odooErrorName: "odoo.exceptions.UserError",
      },
    });

    const baseErr = new OdooError("Custom", { statusCode: 418, code: "TEAPOT" });
    expect(toApiErrorResponse(baseErr)).toEqual({
      status: 418,
      body: { error: "Custom", code: "TEAPOT" },
    });

    expect(toApiErrorResponse(new Error("boom"))).toEqual({
      status: 500,
      body: { error: "boom", code: "INTERNAL_SERVER_ERROR" },
    });

    expect(toApiErrorResponse("raw-string")).toEqual({
      status: 500,
      body: {
        error: "An unexpected server error occurred",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  });
});
