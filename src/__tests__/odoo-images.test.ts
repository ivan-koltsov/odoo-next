import { describe, expect, it } from "vitest";
import { getOdooImageUrl, validateImageParams } from "@/lib/odoo/images";

describe("odoo image helpers", () => {
  it("builds a safe proxy URL for resized product images", () => {
    expect(getOdooImageUrl("product.product", 17, "image_256")).toBe(
      "/api/odoo/image?model=product.product&id=17&field=image_256"
    );
  });

  it("throws when getOdooImageUrl receives a non-positive or non-integer ID", () => {
    expect(() => getOdooImageUrl("product.product", 0)).toThrow(/Invalid record ID/);
    expect(() => getOdooImageUrl("product.product", -4)).toThrow(/Invalid record ID/);
    expect(() => getOdooImageUrl("product.product", 1.5)).toThrow(/Invalid record ID/);
  });

  it("validates allowlisted model, positive integer id, and field", () => {
    expect(
      validateImageParams({ model: "product.product", id: "42", field: "image_128" })
    ).toEqual({
      model: "product.product",
      id: 42,
      field: "image_128",
    });

    expect(
      validateImageParams({ model: "res.partner", id: "42", field: null })
    ).toEqual({
      model: "res.partner",
      id: 42,
      field: "image_256",
    });
  });

  it("rejects non-allowlisted models, fields, and invalid or partial-numeric IDs", () => {
    expect(
      validateImageParams({ model: "ir.attachment", id: "1", field: "image_256" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "1", field: "raw_secret" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "-5", field: "image_256" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "0", field: "image_256" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "42abc", field: "image_256" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "3.14", field: "image_256" })
    ).toBeNull();
    expect(
      validateImageParams({ model: "product.product", id: "abc", field: "image_256" })
    ).toBeNull();
  });
});
