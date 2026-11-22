import { describe, expect, it, vi } from "vitest";
import {
  buildProductDomain,
  getProductById,
  listProductCategories,
  listProducts,
} from "@/lib/odoo/services/products";
import {
  buildPartnerDomain,
  createPartner,
  listPartners,
  updatePartner,
} from "@/lib/odoo/services/partners";

function jsonRpcOk(result: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

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
        jsonRpcOk([
          {
            id: 10,
            name: "Acoustic Bloc Screens",
            list_price: 295,
            default_code: "FURN_6666",
            barcode: false,
            categ_id: [5, "Office Furniture"],
            description_sale: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonRpcOk(42));

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

  it("fetches single product by ID and returns null for invalid IDs or missing records", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonRpcOk([{ id: 7, name: "Office Chair", list_price: 99 }]))
      .mockResolvedValueOnce(jsonRpcOk([]));

    expect(await getProductById("sess_1", 0, { fetchImpl: mockFetch })).toBeNull();
    expect(await getProductById("sess_1", -3, { fetchImpl: mockFetch })).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    const found = await getProductById("sess_1", 7, { fetchImpl: mockFetch });
    expect(found?.id).toBe(7);

    const missing = await getProductById("sess_1", 999, { fetchImpl: mockFetch });
    expect(missing).toBeNull();
  });

  it("lists product categories ordered by complete_name", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonRpcOk([{ id: 1, name: "All", complete_name: "All" }]));

    const categories = await listProductCategories("sess_1", { fetchImpl: mockFetch });
    expect(categories).toEqual([{ id: 1, name: "All", complete_name: "All" }]);
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

  it("lists paginated partners and total count", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonRpcOk([
          {
            id: 3,
            name: "Azure Interior",
            email: "azure@example.com",
            phone: false,
            city: "San Francisco",
            country_id: [233, "United States"],
            is_company: true,
          },
        ])
      )
      .mockResolvedValueOnce(jsonRpcOk(1));

    const res = await listPartners(
      "sess_1",
      { onlyCompanies: true, limit: 10, offset: 0 },
      { fetchImpl: mockFetch }
    );
    expect(res.total).toBe(1);
    expect(res.items[0].name).toBe("Azure Interior");
  });

  it("validates and sends trimmed fields when creating a partner", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonRpcOk(108));

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

    await expect(
      createPartner("sess_1", { name: "   ", email: "bad" }, { fetchImpl: mockFetch })
    ).rejects.toThrow();
  });

  it("validates ID and payload when updating a partner", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonRpcOk(true));

    await expect(
      updatePartner("sess_1", 0, { name: "Valid" }, { fetchImpl: mockFetch })
    ).rejects.toThrow();
    await expect(
      updatePartner("sess_1", 10, {}, { fetchImpl: mockFetch })
    ).rejects.toThrow(/At least one field/);
    expect(mockFetch).not.toHaveBeenCalled();

    const updated = await updatePartner(
      "sess_1",
      10,
      { name: "  Updated Corp  ", email: "" },
      { fetchImpl: mockFetch }
    );
    expect(updated).toBe(true);
    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.params.args).toEqual([[10], { name: "Updated Corp", email: false }]);
  });
});
