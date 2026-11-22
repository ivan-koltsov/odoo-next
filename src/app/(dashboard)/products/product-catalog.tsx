"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { getOdooImageUrl } from "@/lib/odoo/images";
import type { OdooProduct, OdooProductCategory, PaginatedResult } from "@/lib/odoo/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OdooImage } from "@/components/ui/odoo-image";

interface ProductCatalogProps {
  initialData: PaginatedResult<OdooProduct>;
  categories: OdooProductCategory[];
  initialError: string | null;
}

const PAGE_SIZE = 12;

export function ProductCatalog({
  initialData,
  categories,
  initialError,
}: ProductCatalogProps) {
  const [data, setData] = useState<PaginatedResult<OdooProduct>>(initialData);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const fetchPage = async (nextSearch: string, nextCategoryId: string, offset: number) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextCategoryId) params.set("categoryId", nextCategoryId);

      const result = await apiFetch<PaginatedResult<OdooProduct>>(
        `/api/odoo/products?${params.toString()}`
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Unable to load products from Odoo."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    void fetchPage(search, categoryId, 0);
  };

  const handleCategoryChange = (nextCategory: string) => {
    setCategoryId(nextCategory);
    void fetchPage(search, nextCategory, 0);
  };

  const currentPage = Math.floor(data.offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or SKU..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {categories.length > 0 ? (
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-label="Filter by product category"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.complete_name || cat.name}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Could not query product.product</p>
            <p className="mt-0.5 text-rose-700">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Product Grid */}
      {data.items.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No products found</p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search query or create products in your Odoo instance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group block focus:outline-none"
            >
              <Card className="h-full overflow-hidden transition group-hover:border-primary/40 group-hover:shadow-sm">
                <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                  <OdooImage
                    src={getOdooImageUrl("product.product", product.id, "image_256")}
                    alt={product.name}
                    width={256}
                    height={256}
                    className="h-full w-full object-contain p-3 transition duration-200 group-hover:scale-105"
                  />
                </div>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-primary">
                      {product.name}
                    </h3>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      ${Number(product.list_price ?? 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {product.categ_id ? (
                      <Badge variant="default">{product.categ_id[1]}</Badge>
                    ) : null}
                    {product.default_code ? (
                      <Badge variant="primary">SKU: {product.default_code}</Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            Showing <span className="font-medium text-slate-900">{data.offset + 1}</span>–
            <span className="font-medium text-slate-900">
              {Math.min(data.offset + data.items.length, data.total)}
            </span>{" "}
            of <span className="font-medium text-slate-900">{data.total}</span> products
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || data.offset === 0}
              onClick={() =>
                void fetchPage(search, categoryId, Math.max(0, data.offset - PAGE_SIZE))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={loading || data.offset + PAGE_SIZE >= data.total}
              onClick={() => void fetchPage(search, categoryId, data.offset + PAGE_SIZE)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
