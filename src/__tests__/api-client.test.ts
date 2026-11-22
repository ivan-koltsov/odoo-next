import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiFetch, odooCall } from "@/lib/api/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("browser apiFetch and odooCall", () => {
  it("sends credentials: include and JSON content-type header", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;

    const data = await apiFetch<{ ok: boolean }>("/api/health");
    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws ApiClientError with status and code on structured error response", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Invalid login payload", code: "INVALID_REQUEST" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    try {
      await apiFetch("/api/odoo/auth/login", { method: "POST" });
      expect.fail("Expected ApiClientError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as ApiClientError).status).toBe(400);
      expect((error as ApiClientError).code).toBe("INVALID_REQUEST");
      expect((error as ApiClientError).message).toBe("Invalid login payload");
    }
  });

  it("falls back to status message when error response is non-JSON", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 })
    );

    await expect(apiFetch("/api/odoo/products")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 502,
      message: "Request failed with status 502",
    });
  });

  it("posts model, method, args, kwargs to /api/odoo/call and unwraps result", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [{ id: 1, name: "Desk" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch;

    const result = await odooCall<Array<{ id: number; name: string }>>(
      "product.product",
      "search_read",
      [[]],
      { fields: ["name"], limit: 5 }
    );

    expect(result).toEqual([{ id: 1, name: "Desk" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/odoo/call");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "product.product",
      method: "search_read",
      args: [[]],
      kwargs: { fields: ["name"], limit: 5 },
    });
  });
});
