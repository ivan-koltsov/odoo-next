import { describe, expect, it, vi } from "vitest";
import { buildProductDomain, listProducts } from "@/lib/odoo/services/products";
import { buildPartnerDomain, createPartner } from "@/lib/odoo/services/partners";

describe("product service", () => {
  it("builds search and category domains cleanly", () => {
    expect(buildProductDomain({ search: "Chair", categoryId: 5 })).toEqual([
      ["active", "=", true],
      ["categ_id", "=", 5],
      "|",
      ["name", "ilike", "Chair"],
      ["default_code", "ilike", "Chair"],
    ]);
  });

  it("fetches paginated products and total count in parallel", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: [
              {
                id: 10,
                name: "Acoustic Bloc Screens",
                list_price: 295,
                default_code: "FURN_6666",
                barcode: false,
                categ_id: [5, "Office Furniture"],
                description_sale: false,
              },
            ],
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: 42,
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      );

    const res = await listProducts(
      "sess_1",
      { search: "Bloc", limit: 12, offset: 0 },
      { baseUrl: "http://localhost:8069", fetchImpl: mockFetch }
    );

    expect(res.total).toBe(42);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].name).toBe("Acoustic Bloc Screens");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("partner service", () => {
  it("builds company + search domain", () => {
    expect(buildPartnerDomain({ search: "Acme", onlyCompanies: true })).toEqual([
      ["active", "=", true],
      ["is_company", "=", true],
      "|",
      ["name", "ilike", "Acme"],
      ["email", "ilike", "Acme"],
    ]);
  });

  it("sends trimmed fields when creating a partner", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: 108,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );

    const id = await createPartner(
      "sess_1",
      {
        name: "  Acme Corp  ",
        email: " sales@acme.test ",
        city: "",
        is_company: true,
      },
      { baseUrl: "http://localhost:8069", fetchImpl: mockFetch }
    );

    expect(id).toBe(108);
    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.params.args).toEqual([
      {
        name: "Acme Corp",
        email: "sales@acme.test",
        is_company: true,
      },
    ]);
  });
});
