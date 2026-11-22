import type { Metadata } from "next";
import { requireSession } from "@/lib/odoo/session";
import {
  listProductCategories,
  listProducts,
} from "@/lib/odoo/services/products";
import type { OdooProduct, OdooProductCategory, PaginatedResult } from "@/lib/odoo/types";
import { ProductCatalog } from "./product-catalog";

export const metadata: Metadata = {
  title: "Products",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { sessionId } = await requireSession();

  let initialData: PaginatedResult<OdooProduct> = {
    items: [],
    total: 0,
    limit: 12,
    offset: 0,
  };
  let categories: OdooProductCategory[] = [];
  let initialError: string | null = null;

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      listProducts(sessionId, { limit: 12, offset: 0 }),
      listProductCategories(sessionId),
    ]);
    initialData = productsRes;
    categories = categoriesRes;
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "Failed to load products from Odoo. Make sure the Products / Sales / Inventory module is installed.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live catalog from Odoo <code className="font-mono text-xs">product.product</code>{" "}
          using selective fields, pagination, and proxied{" "}
          <code className="font-mono text-xs">image_256</code> thumbnails.
        </p>
      </div>

      <ProductCatalog
        initialData={initialData}
        categories={categories}
        initialError={initialError}
      />
    </div>
  );
}
