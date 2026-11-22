import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Barcode, Tag } from "lucide-react";
import { requireSession } from "@/lib/odoo/session";
import { getOdooImageUrl } from "@/lib/odoo/images";
import { getProductById } from "@/lib/odoo/services/products";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OdooImage } from "@/components/ui/odoo-image";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { sessionId } = await requireSession();
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const product = await getProductById(sessionId, id);
  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <Card className="overflow-hidden">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex min-h-72 items-center justify-center bg-slate-50 p-8">
            <OdooImage
              src={getOdooImageUrl("product.product", product.id, "image_512")}
              alt={product.name}
              width={512}
              height={512}
              className="max-h-80 w-auto rounded-lg object-contain"
              fallbackClassName="flex h-64 w-64 items-center justify-center rounded-xl bg-slate-100 text-slate-400"
            />
          </div>

          <CardContent className="flex flex-col justify-between space-y-6 py-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {product.categ_id ? (
                  <Badge variant="primary">
                    <Tag className="h-3 w-3" />
                    {product.categ_id[1]}
                  </Badge>
                ) : null}
                {product.type ? (
                  <Badge variant="default" className="capitalize">
                    {product.type}
                  </Badge>
                ) : null}
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
                <p className="mt-2 text-2xl font-bold text-primary">
                  ${Number(product.list_price ?? 0).toFixed(2)}
                </p>
              </div>

              {product.description_sale ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  {product.description_sale}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">
                  No sales description configured in Odoo for this product.
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
              <div>
                <dt className="text-slate-500">Internal Reference (SKU)</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-900">
                  {product.default_code || "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-slate-500">
                  <Barcode className="h-3.5 w-3.5" />
                  Barcode
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-900">
                  {product.barcode || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Odoo Record ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-900">#{product.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Model</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-900">
                  product.product
                </dd>
              </div>
            </dl>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
