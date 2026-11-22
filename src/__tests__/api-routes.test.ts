import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OdooAuthError, OdooConnectionError, OdooRpcError } from "@/lib/odoo/errors";

const sessionMocks = vi.hoisted(() => ({
  getSessionId: vi.fn(),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

const clientMocks = vi.hoisted(() => ({
  odooAuthenticate: vi.fn(),
  odooGetSessionInfo: vi.fn(),
  odooDestroySession: vi.fn(),
  odooGetVersionInfo: vi.fn(),
  odooCall: vi.fn(),
}));

const productServiceMocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  getProductById: vi.fn(),
}));

const partnerServiceMocks = vi.hoisted(() => ({
  listPartners: vi.fn(),
  createPartner: vi.fn(),
}));

vi.mock("@/lib/odoo/session", () => sessionMocks);
vi.mock("@/lib/odoo/client", () => clientMocks);
vi.mock("@/lib/odoo/services/products", () => productServiceMocks);
vi.mock("@/lib/odoo/services/partners", () => partnerServiceMocks);

import { GET as getHealth } from "@/app/api/health/route";
import { POST as postLogin } from "@/app/api/odoo/auth/login/route";
import { POST as postLogout } from "@/app/api/odoo/auth/logout/route";
import { GET as getSession } from "@/app/api/odoo/auth/session/route";
import { POST as postCall } from "@/app/api/odoo/call/route";
import { GET as getImage } from "@/app/api/odoo/image/route";
import { GET as getProducts } from "@/app/api/odoo/products/route";
import { GET as getProductByIdRoute } from "@/app/api/odoo/products/[id]/route";
import { GET as getPartners, POST as postPartner } from "@/app/api/odoo/partners/route";

const MOCK_USER = {
  uid: 2,
  name: "Mitchell Admin",
  username: "admin",
  db: "odoo",
  partnerId: 3,
  companyId: 1,
  serverVersion: "18.0",
  isAdmin: true,
  isSystem: true,
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /api/health", () => {
  it("returns ok with Odoo version when reachable", async () => {
    clientMocks.odooGetVersionInfo.mockResolvedValueOnce({ server_version: "18.0" });

    const res = await getHealth();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      odoo: {
        reachable: true,
        serverVersion: "18.0",
        defaultDb: "odoo",
      },
    });
  });

  it("returns degraded when Odoo is unreachable", async () => {
    clientMocks.odooGetVersionInfo.mockRejectedValueOnce(
      new OdooConnectionError("Connection refused")
    );

    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.odoo.reachable).toBe(false);
    expect(body.odoo.error).toContain("Connection refused");
  });
});

describe("Auth routes (/api/odoo/auth/*)", () => {
  it("POST /login validates payload and returns 400 with fieldErrors", async () => {
    const req = new Request("http://localhost:3000/api/odoo/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "", password: "" }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_REQUEST");
    expect(body.fieldErrors.login).toBeDefined();
    expect(sessionMocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("POST /login authenticates, sets HttpOnly cookie, and returns user", async () => {
    clientMocks.odooAuthenticate.mockResolvedValueOnce({
      user: MOCK_USER,
      sessionId: "sid_999",
    });

    const req = new Request("http://localhost:3000/api/odoo/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "admin", password: "secret", db: "odoo" }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ user: MOCK_USER });
    expect(sessionMocks.setSessionCookie).toHaveBeenCalledWith("sid_999");
  });

  it("POST /login maps OdooAuthError to 401", async () => {
    clientMocks.odooAuthenticate.mockRejectedValueOnce(new OdooAuthError("Bad credentials"));

    const req = new Request("http://localhost:3000/api/odoo/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: "admin", password: "wrong" }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(401);
  });

  it("POST /logout destroys Odoo session and clears cookie", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_old");

    const res = await postLogout();
    expect(res.status).toBe(200);
    expect(clientMocks.odooDestroySession).toHaveBeenCalledWith("sid_old");
    expect(sessionMocks.clearSessionCookie).toHaveBeenCalled();
  });

  it("GET /session returns unauthenticated when missing or clears expired session", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce(null);
    const res1 = await getSession();
    await expect(res1.json()).resolves.toEqual({ authenticated: false, user: null });

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_expired");
    clientMocks.odooGetSessionInfo.mockResolvedValueOnce(null);
    const res2 = await getSession();
    await expect(res2.json()).resolves.toEqual({ authenticated: false, user: null });
    expect(sessionMocks.clearSessionCookie).toHaveBeenCalledTimes(1);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    clientMocks.odooGetSessionInfo.mockResolvedValueOnce(MOCK_USER);
    const res3 = await getSession();
    await expect(res3.json()).resolves.toEqual({ authenticated: true, user: MOCK_USER });
  });
});

describe("POST /api/odoo/call", () => {
  it("returns 401 when unauthenticated", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce(null);
    const req = new Request("http://localhost:3000/api/odoo/call", {
      method: "POST",
      body: JSON.stringify({ model: "res.partner", method: "search_read" }),
    });

    const res = await postCall(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid model/method payload", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const req = new Request("http://localhost:3000/api/odoo/call", {
      method: "POST",
      body: JSON.stringify({ model: "../bad", method: "search_read" }),
    });

    const res = await postCall(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("proxies valid call_kw requests and clears cookie on expired session error", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    clientMocks.odooCall.mockResolvedValueOnce([{ id: 1 }]);

    const req = new Request("http://localhost:3000/api/odoo/call", {
      method: "POST",
      body: JSON.stringify({
        model: "res.partner",
        method: "search_read",
        args: [[]],
        kwargs: { limit: 5 },
      }),
    });
    const res = await postCall(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ result: [{ id: 1 }] });

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_stale");
    clientMocks.odooCall.mockRejectedValueOnce(
      new OdooRpcError({
        code: 100,
        message: "Odoo Session Expired",
        data: { name: "odoo.http.SessionExpiredException", message: "Session expired" },
      })
    );
    const req2 = new Request("http://localhost:3000/api/odoo/call", {
      method: "POST",
      body: JSON.stringify({ model: "res.partner", method: "search_read" }),
    });
    const res2 = await postCall(req2);
    expect(res2.status).toBe(401);
    expect(sessionMocks.clearSessionCookie).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/odoo/image", () => {
  it("enforces authentication and strict query validation", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce(null);
    const resUnauth = await getImage(
      new Request("http://localhost:3000/api/odoo/image?model=product.product&id=1")
    );
    expect(resUnauth.status).toBe(401);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const resBad = await getImage(
      new Request("http://localhost:3000/api/odoo/image?model=ir.attachment&id=1")
    );
    expect(resBad.status).toBe(400);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const resBadId = await getImage(
      new Request("http://localhost:3000/api/odoo/image?model=product.product&id=12abc")
    );
    expect(resBadId.status).toBe(400);
  });

  it("streams image binary with cache headers and rejects non-image content", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(pngBytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );

    const res = await getImage(
      new Request(
        "http://localhost:3000/api/odoo/image?model=product.product&id=7&field=image_256"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response("<html>login</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );
    const resHtml = await getImage(
      new Request("http://localhost:3000/api/odoo/image?model=product.product&id=7")
    );
    expect(resHtml.status).toBe(404);
  });
});

describe("Products & Partners routes", () => {
  it("GET /api/odoo/products validates query params and returns paginated list", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const badRes = await getProducts(
      new Request("http://localhost:3000/api/odoo/products?limit=999")
    );
    expect(badRes.status).toBe(400);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    productServiceMocks.listProducts.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 12,
      offset: 0,
    });
    const okRes = await getProducts(
      new Request(
        "http://localhost:3000/api/odoo/products?search=Desk&categoryId=3&limit=12&offset=0"
      )
    );
    expect(okRes.status).toBe(200);
    expect(productServiceMocks.listProducts).toHaveBeenCalledWith("sid_ok", {
      search: "Desk",
      categoryId: 3,
      limit: 12,
      offset: 0,
    });
  });

  it("GET /api/odoo/products/[id] validates strict positive ID and handles 404/200", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const badRes = await getProductByIdRoute(
      new Request("http://localhost:3000/api/odoo/products/12abc"),
      { params: Promise.resolve({ id: "12abc" }) }
    );
    expect(badRes.status).toBe(400);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    productServiceMocks.getProductById.mockResolvedValueOnce(null);
    const missingRes = await getProductByIdRoute(
      new Request("http://localhost:3000/api/odoo/products/99"),
      { params: Promise.resolve({ id: "99" }) }
    );
    expect(missingRes.status).toBe(404);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    productServiceMocks.getProductById.mockResolvedValueOnce({ id: 99, name: "Desk" });
    const okRes = await getProductByIdRoute(
      new Request("http://localhost:3000/api/odoo/products/99"),
      { params: Promise.resolve({ id: "99" }) }
    );
    expect(okRes.status).toBe(200);
    await expect(okRes.json()).resolves.toEqual({ product: { id: 99, name: "Desk" } });
  });

  it("GET and POST /api/odoo/partners validate inputs and return expected statuses", async () => {
    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const badGet = await getPartners(
      new Request("http://localhost:3000/api/odoo/partners?onlyCompanies=invalid")
    );
    expect(badGet.status).toBe(400);

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    partnerServiceMocks.listPartners.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    const okGet = await getPartners(
      new Request("http://localhost:3000/api/odoo/partners?onlyCompanies=true&search=Acme")
    );
    expect(okGet.status).toBe(200);
    expect(partnerServiceMocks.listPartners).toHaveBeenCalledWith("sid_ok", {
      search: "Acme",
      onlyCompanies: true,
      limit: 20,
      offset: 0,
    });

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    const badPost = await postPartner(
      new Request("http://localhost:3000/api/odoo/partners", {
        method: "POST",
        body: JSON.stringify({ name: "Acme", email: "not-an-email" }),
      })
    );
    expect(badPost.status).toBe(400);
    const badBody = await badPost.json();
    expect(badBody.fieldErrors.email).toBeDefined();

    sessionMocks.getSessionId.mockResolvedValueOnce("sid_ok");
    partnerServiceMocks.createPartner.mockResolvedValueOnce(55);
    const okPost = await postPartner(
      new Request("http://localhost:3000/api/odoo/partners", {
        method: "POST",
        body: JSON.stringify({
          name: "Acme Corp",
          email: "hello@acme.test",
          is_company: true,
        }),
      })
    );
    expect(okPost.status).toBe(201);
    await expect(okPost.json()).resolves.toEqual({ id: 55 });
  });
});
