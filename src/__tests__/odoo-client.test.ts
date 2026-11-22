import { describe, expect, it, vi } from "vitest";
import {
  extractSessionIdFromHeaders,
  normalizeSessionUser,
  odooAuthenticate,
  odooCall,
  odooDestroySession,
  odooGetSessionInfo,
  odooGetVersionInfo,
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
      "set-cookie":
        "session_id=abc123xyz; Expires=Wed, 21 Oct 2027 07:28:00 GMT; Path=/; HttpOnly",
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

  it("handles minimal payloads with fallback company_id and default display name", () => {
    const user = normalizeSessionUser({
      uid: 9,
      company_id: 4,
      partner_id: false,
    });

    expect(user).toEqual({
      uid: 9,
      name: "User #9",
      username: "",
      db: "odoo",
      partnerId: null,
      companyId: 4,
      serverVersion: null,
      isAdmin: false,
      isSystem: false,
    });
  });

  it("returns null when uid is false or nullish", () => {
    expect(normalizeSessionUser({ uid: false })).toBeNull();
    expect(normalizeSessionUser(null)).toBeNull();
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

  it("throws OdooConnectionError on network error, timeout AbortError, non-200 HTTP, or non-JSON body", async () => {
    const networkMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      odooRpc("/web/webclient/version_info", {}, { fetchImpl: networkMock })
    ).rejects.toBeInstanceOf(OdooConnectionError);

    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const timeoutMock = vi.fn<typeof fetch>().mockRejectedValueOnce(abortErr);
    await expect(
      odooRpc("/web/webclient/version_info", {}, { timeoutMs: 250, fetchImpl: timeoutMock })
    ).rejects.toThrow(/timed out after 250ms/);

    const http502Mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" }));
    await expect(
      odooRpc("/web/webclient/version_info", {}, { fetchImpl: http502Mock })
    ).rejects.toThrow(/HTTP 502/);

    const nonJsonMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("<html>error</html>", { status: 200 }));
    await expect(
      odooRpc("/web/webclient/version_info", {}, { fetchImpl: nonJsonMock })
    ).rejects.toThrow(/non-JSON response/);
  });
});

describe("odooAuthenticate, session info, destroy, and version info", () => {
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

  it("throws OdooAuthError when uid is false or session_id cookie is missing", async () => {
    const badCredsFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({ jsonrpc: "2.0", id: 1, result: { uid: false } })
    );
    await expect(
      odooAuthenticate({ login: "admin", password: "wrong", db: "demo" }, { fetchImpl: badCredsFetch })
    ).rejects.toBeInstanceOf(OdooAuthError);

    const missingCookieFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({ jsonrpc: "2.0", id: 1, result: { uid: 2, name: "Admin" } })
    );
    await expect(
      odooAuthenticate(
        { login: "admin", password: "secret", db: "demo" },
        { fetchImpl: missingCookieFetch }
      )
    ).rejects.toThrow(/did not return a session_id cookie/);
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

  it("swallows errors in odooDestroySession and returns version from odooGetVersionInfo", async () => {
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("offline"));
    await expect(
      odooDestroySession("sid_1", { fetchImpl: failingFetch })
    ).resolves.toBeUndefined();

    const versionFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      createJsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { server_version: "18.0", protocol_version: 1 },
      })
    );
    await expect(odooGetVersionInfo({ fetchImpl: versionFetch })).resolves.toEqual({
      server_version: "18.0",
      protocol_version: 1,
    });
  });
});
