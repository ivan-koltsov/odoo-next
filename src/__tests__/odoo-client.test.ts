import { describe, expect, it, vi } from "vitest";
import {
  extractSessionIdFromHeaders,
  normalizeSessionUser,
  odooAuthenticate,
  odooCall,
  odooGetSessionInfo,
  odooRpc,
} from "@/lib/odoo/client";
import {
  OdooAuthError,
  OdooConnectionError,
  OdooRpcError,
  isOdooSessionExpiredError,
} from "@/lib/odoo/errors";

function createJsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

describe("extractSessionIdFromHeaders", () => {
  it("extracts session_id from Set-Cookie header", () => {
    const headers = new Headers({
      "set-cookie": "session_id=abc123xyz; Expires=Wed, 21 Oct 2027 07:28:00 GMT; Path=/; HttpOnly",
    });
    expect(extractSessionIdFromHeaders(headers)).toBe("abc123xyz");
  });

  it("returns null when session_id is missing", () => {
    const headers = new Headers({ "set-cookie": "frontend_lang=en_US; Path=/" });
    expect(extractSessionIdFromHeaders(headers)).toBeNull();
  });
});

describe("normalizeSessionUser", () => {
  it("normalizes a valid Odoo session payload", () => {
    const user = normalizeSessionUser({
      uid: 2,
      name: "Mitchell Admin",
      username: "admin",
      db: "odoo_dev",
      partner_id: 3,
      server_version: "18.0",
      is_admin: true,
      is_system: true,
      user_companies: { current_company: 1 },
    });

    expect(user).toEqual({
      uid: 2,
      name: "Mitchell Admin",
      username: "admin",
      db: "odoo_dev",
      partnerId: 3,
      companyId: 1,
      serverVersion: "18.0",
      isAdmin: true,
      isSystem: true,
    });
  });

  it("returns null when uid is false", () => {
    expect(normalizeSessionUser({ uid: false })).toBeNull();
  });
});

describe("odooRpc and odooCall", () => {
  it("sends JSON-RPC 2.0 envelope and forwards session_id cookie", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: [{ id: 1, name: "Desk" }],
      })
    );

    const result = await odooCall<Array<{ id: number; name: string }>>(
      "product.product",
      "search_read",
      [[]],
      { fields: ["name"], limit: 10 },
      {
        baseUrl: "http://odoo.internal:8069",
        sessionId: "sess_42",
        fetchImpl: mockFetch,
      }
    );

    expect(result).toEqual([{ id: 1, name: "Desk" }]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://odoo.internal:8069/web/dataset/call_kw/product.product/search_read");
    expect((init?.headers as Record<string, string>).Cookie).toBe("session_id=sess_42");

    const parsedBody = JSON.parse(String(init?.body));
    expect(parsedBody.jsonrpc).toBe("2.0");
    expect(parsedBody.method).toBe("call");
    expect(parsedBody.params).toEqual({
      model: "product.product",
      method: "search_read",
      args: [[]],
      kwargs: { fields: ["name"], limit: 10 },
    });
  });

  it("rejects invalid model or method identifiers", async () => {
    await expect(odooCall("product.product/../evil", "search_read")).rejects.toThrow(
      /Invalid Odoo model name/
    );
    await expect(odooCall("product.product", "search;drop")).rejects.toThrow(
      /Invalid Odoo method name/
    );
  });

  it("maps Odoo SessionExpiredException to 401 OdooRpcError", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: 100,
          message: "Odoo Session Expired",
          data: {
            name: "odoo.http.SessionExpiredException",
            message: "Session expired",
          },
        },
      })
    );

    try {
      await odooRpc("/web/dataset/call_kw", {}, { fetchImpl: mockFetch });
      expect.fail("Expected OdooRpcError");
    } catch (error) {
      expect(error).toBeInstanceOf(OdooRpcError);
      expect(isOdooSessionExpiredError(error)).toBe(true);
      expect((error as OdooRpcError).statusCode).toBe(401);
    }
  });

  it("throws OdooConnectionError when fetch rejects", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      odooRpc("/web/webclient/version_info", {}, { fetchImpl: mockFetch })
    ).rejects.toBeInstanceOf(OdooConnectionError);
  });
});

describe("odooAuthenticate and odooGetSessionInfo", () => {
  it("authenticates and extracts both user and sessionId", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse(
        {
          jsonrpc: "2.0",
          id: 1,
          result: {
            uid: 2,
            name: "Admin",
            username: "admin",
            db: "demo",
            partner_id: 3,
          },
        },
        {
          headers: {
            "set-cookie": "session_id=tok_999; Path=/; HttpOnly",
          },
        }
      )
    );

    const auth = await odooAuthenticate(
      { login: "admin", password: "secret", db: "demo" },
      { baseUrl: "http://localhost:8069", fetchImpl: mockFetch }
    );

    expect(auth.sessionId).toBe("tok_999");
    expect(auth.user.uid).toBe(2);
    expect(auth.user.db).toBe("demo");
  });

  it("throws OdooAuthError when uid is false", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { uid: false },
      })
    );

    await expect(
      odooAuthenticate(
        { login: "admin", password: "wrong", db: "demo" },
        { fetchImpl: mockFetch }
      )
    ).rejects.toBeInstanceOf(OdooAuthError);
  });

  it("returns null from odooGetSessionInfo on expired session", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: 100,
          message: "Odoo Session Expired",
          data: { name: "odoo.http.SessionExpiredException", message: "Session expired" },
        },
      })
    );

    const session = await odooGetSessionInfo("expired_token", { fetchImpl: mockFetch });
    expect(session).toBeNull();
  });
});
