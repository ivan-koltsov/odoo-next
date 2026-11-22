import { describe, expect, it } from "vitest";
import {
  createPartnerSchema,
  formatZodError,
  imageQuerySchema,
  loginSchema,
  odooConfigSchema,
  partnerListQuerySchema,
  positiveIntIdSchema,
  productListQuerySchema,
  rpcCallSchema,
  updatePartnerSchema,
} from "@/lib/odoo/validation";

describe("positiveIntIdSchema", () => {
  it("accepts positive integers and numeric strings", () => {
    expect(positiveIntIdSchema.parse(42)).toBe(42);
    expect(positiveIntIdSchema.parse("42")).toBe(42);
    expect(positiveIntIdSchema.parse("  7 ")).toBe(7);
  });

  it("rejects trailing junk, zero, negatives, floats, and non-numeric strings", () => {
    for (const invalid of ["42abc", "0", "-1", "3.14", "abc", "", 0, -5, 1.5]) {
      expect(positiveIntIdSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

describe("odooConfigSchema", () => {
  it("normalizes trailing slashes on valid HTTP/HTTPS URLs", () => {
    const parsed = odooConfigSchema.parse({
      baseUrl: "https://odoo.example.com///",
      db: "prod_db-1.0",
      timeoutMs: 10_000,
      sessionCookieName: "odoo_session_id",
    });

    expect(parsed.baseUrl).toBe("https://odoo.example.com");
    expect(parsed.db).toBe("prod_db-1.0");
  });

  it("rejects non-HTTP schemes, bad DB names, out-of-range timeouts, and bad cookie names", () => {
    expect(
      odooConfigSchema.safeParse({
        baseUrl: "file:///etc/passwd",
        db: "odoo",
        timeoutMs: 5000,
        sessionCookieName: "odoo_session_id",
      }).success
    ).toBe(false);

    expect(
      odooConfigSchema.safeParse({
        baseUrl: "http://localhost:8069",
        db: "../bad db",
        timeoutMs: 5000,
        sessionCookieName: "odoo_session_id",
      }).success
    ).toBe(false);

    expect(
      odooConfigSchema.safeParse({
        baseUrl: "http://localhost:8069",
        db: "odoo",
        timeoutMs: 50,
        sessionCookieName: "odoo_session_id",
      }).success
    ).toBe(false);

    expect(
      odooConfigSchema.safeParse({
        baseUrl: "http://localhost:8069",
        db: "odoo",
        timeoutMs: 5000,
        sessionCookieName: "bad;cookie=name",
      }).success
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("trims login and db while preserving password whitespace", () => {
    const parsed = loginSchema.parse({
      login: "  admin@example.com  ",
      password: "  p@ss  ",
      db: "  odoo_dev  ",
    });

    expect(parsed).toEqual({
      login: "admin@example.com",
      password: "  p@ss  ",
      db: "odoo_dev",
    });
  });

  it("treats empty db string as undefined and rejects invalid db characters", () => {
    const parsed = loginSchema.parse({
      login: "admin",
      password: "secret",
      db: "   ",
    });
    expect(parsed.db).toBeUndefined();

    expect(
      loginSchema.safeParse({
        login: "admin",
        password: "secret",
        db: "db;drop",
      }).success
    ).toBe(false);
  });

  it("rejects empty login or password", () => {
    expect(loginSchema.safeParse({ login: "   ", password: "secret" }).success).toBe(false);
    expect(loginSchema.safeParse({ login: "admin", password: "" }).success).toBe(false);
  });
});

describe("rpcCallSchema", () => {
  it("applies default args and kwargs for valid RPC payloads", () => {
    const parsed = rpcCallSchema.parse({
      model: "product.product",
      method: "search_read",
    });

    expect(parsed).toEqual({
      model: "product.product",
      method: "search_read",
      args: [],
      kwargs: {},
    });
  });

  it("rejects malformed model/method names and non-array args", () => {
    expect(
      rpcCallSchema.safeParse({ model: "../etc", method: "search_read" }).success
    ).toBe(false);
    expect(
      rpcCallSchema.safeParse({ model: "123model", method: "search_read" }).success
    ).toBe(false);
    expect(
      rpcCallSchema.safeParse({ model: "res.partner", method: "search;drop" }).success
    ).toBe(false);
    expect(
      rpcCallSchema.safeParse({
        model: "res.partner",
        method: "search_read",
        args: "not-an-array",
      }).success
    ).toBe(false);
  });
});

describe("productListQuerySchema", () => {
  it("parses defaults and valid query params", () => {
    expect(productListQuerySchema.parse({})).toEqual({
      search: undefined,
      categoryId: undefined,
      limit: 20,
      offset: 0,
    });

    expect(
      productListQuerySchema.parse({
        search: "  Chair ",
        categoryId: "5",
        limit: "50",
        offset: "20",
      })
    ).toEqual({
      search: "Chair",
      categoryId: 5,
      limit: 50,
      offset: 20,
    });
  });

  it("rejects invalid limit, offset, categoryId, or overly long search", () => {
    expect(productListQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ limit: "10abc" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ categoryId: "abc" }).success).toBe(false);
    expect(
      productListQuerySchema.safeParse({ search: "a".repeat(201) }).success
    ).toBe(false);
  });
});

describe("partnerListQuerySchema", () => {
  it("parses boolean onlyCompanies and pagination", () => {
    expect(partnerListQuerySchema.parse({ onlyCompanies: "TRUE", limit: "10" })).toEqual({
      search: undefined,
      onlyCompanies: true,
      limit: 10,
      offset: 0,
    });

    expect(partnerListQuerySchema.parse({})).toEqual({
      search: undefined,
      onlyCompanies: false,
      limit: 20,
      offset: 0,
    });
  });

  it("rejects non-boolean onlyCompanies values", () => {
    expect(partnerListQuerySchema.safeParse({ onlyCompanies: "yes" }).success).toBe(false);
  });
});

describe("createPartnerSchema and updatePartnerSchema", () => {
  it("validates valid partner creation payloads and defaults is_company to false", () => {
    const parsed = createPartnerSchema.parse({
      name: "  Acme Corp ",
      email: " info@acme.test ",
      phone: "+1 (555) 123-4567",
      city: " Austin ",
    });

    expect(parsed).toEqual({
      name: "Acme Corp",
      email: "info@acme.test",
      phone: "+1 (555) 123-4567",
      city: "Austin",
      is_company: false,
    });
  });

  it("rejects invalid email and invalid phone characters", () => {
    expect(
      createPartnerSchema.safeParse({ name: "Test", email: "not-an-email" }).success
    ).toBe(false);
    expect(
      createPartnerSchema.safeParse({ name: "Test", phone: "555-CALL-NOW!" }).success
    ).toBe(false);
  });

  it("requires at least one field in updatePartnerSchema", () => {
    expect(updatePartnerSchema.safeParse({}).success).toBe(false);
    expect(updatePartnerSchema.safeParse({ city: "Berlin" }).success).toBe(true);
    expect(updatePartnerSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("imageQuerySchema and formatZodError", () => {
  it("validates allowlisted model/field and defaults field to image_256", () => {
    expect(
      imageQuerySchema.parse({ model: "product.product", id: "15" })
    ).toEqual({
      model: "product.product",
      id: 15,
      field: "image_256",
    });
  });

  it("rejects disallowed models, fields, and malformed IDs", () => {
    expect(
      imageQuerySchema.safeParse({ model: "ir.attachment", id: "15", field: "image_256" })
        .success
    ).toBe(false);
    expect(
      imageQuerySchema.safeParse({ model: "product.product", id: "15abc", field: "image_256" })
        .success
    ).toBe(false);
  });

  it("formats Zod errors into structured fieldErrors payload", () => {
    const result = loginSchema.safeParse({ login: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.code).toBe("INVALID_REQUEST");
      expect(formatted.error).toBe("Username or email is required");
      expect(formatted.fieldErrors.login).toEqual(["Username or email is required"]);
      expect(formatted.fieldErrors.password).toEqual(["Password is required"]);
    }
  });
});
