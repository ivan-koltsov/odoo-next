import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Package,
  Terminal,
  UserCheck,
  Users,
} from "lucide-react";
import { requireSession } from "@/lib/odoo/session";
import { odooCall } from "@/lib/odoo/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const { sessionId, user } = await requireSession();

  const [productsCountResult, partnersCountResult] = await Promise.allSettled([
    odooCall<number>("product.product", "search_count", [[["active", "=", true]]], {}, { sessionId }),
    odooCall<number>("res.partner", "search_count", [[["active", "=", true]]], {}, { sessionId }),
  ]);

  const productsCount =
    productsCountResult.status === "fulfilled" ? productsCountResult.value : null;
  const partnersCount =
    partnersCountResult.status === "fulfilled" ? partnersCountResult.value : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Connected to Odoo via native JSON-RPC and HttpOnly session authentication.
          </p>
        </div>
        <Badge variant="success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Session Active (UID {user.uid})
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Products</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {productsCount !== null ? productsCount.toLocaleString() : "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {productsCount !== null
                  ? "Model: product.product"
                  : "Install Sales or Inventory in Odoo"}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Contacts</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {partnersCount !== null ? partnersCount.toLocaleString() : "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Model: res.partner</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Odoo Instance</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {user.serverVersion || "Odoo 18"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Database: {user.db}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Database className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Modules */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="transition hover:border-primary/40">
          <CardContent className="flex h-full flex-col justify-between py-5">
            <div>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Package className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Product Catalog</h2>
              <p className="mt-1 text-sm text-slate-500">
                Browse paginated <code className="font-mono text-xs">product.product</code>{" "}
                records with resized <code className="font-mono text-xs">image_256</code>{" "}
                proxies and detail views.
              </p>
            </div>
            <Link
              href="/products"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              Open Products <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition hover:border-primary/40">
          <CardContent className="flex h-full flex-col justify-between py-5">
            <div>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Contacts &amp; CRUD</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search and create <code className="font-mono text-xs">res.partner</code>{" "}
                records directly in Odoo through typed BFF Route Handlers.
              </p>
            </div>
            <Link
              href="/partners"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              Open Contacts <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition hover:border-primary/40">
          <CardContent className="flex h-full flex-col justify-between py-5">
            <div>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Terminal className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">JSON-RPC Explorer</h2>
              <p className="mt-1 text-sm text-slate-500">
                Execute arbitrary <code className="font-mono text-xs">call_kw</code>{" "}
                queries against any Odoo model as you build new modules.
              </p>
            </div>
            <Link
              href="/explorer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              Open Explorer <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      <Card>
        <CardHeader
          title="Authenticated Session"
          description="Session cookie is stored HttpOnly on the Next.js origin and forwarded server-side to Odoo."
          action={
            <Badge variant="primary">
              <UserCheck className="h-3.5 w-3.5" />
              {user.isAdmin ? "Administrator" : "Standard User"}
            </Badge>
          }
        />
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">User</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Login</dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-900">{user.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Partner ID</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {user.partnerId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Company ID</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {user.companyId ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
