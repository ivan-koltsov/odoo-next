import { redirect } from "next/navigation";
import { getOdooConfig } from "@/lib/odoo/config";
import { odooGetVersionInfo } from "@/lib/odoo/client";
import { getCurrentSession } from "@/lib/odoo/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  const config = getOdooConfig();
  let odooStatus: { reachable: boolean; serverVersion?: string; error?: string };

  try {
    const version = await odooGetVersionInfo({ timeoutMs: 2_500 });
    odooStatus = {
      reachable: true,
      serverVersion: version.server_version,
    };
  } catch (error) {
    odooStatus = {
      reachable: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to Odoo backend",
    };
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-sm">
            O
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {process.env.NEXT_PUBLIC_APP_NAME || "Odoo Next"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your Odoo account via JSON-RPC session authentication
          </p>
        </div>

        <LoginForm defaultDb={config.db} initialStatus={odooStatus} />
      </div>
    </main>
  );
}
