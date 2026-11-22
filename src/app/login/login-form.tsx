"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, Database } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import type { OdooSessionUser } from "@/lib/odoo/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface LoginFormProps {
  defaultDb: string;
  initialStatus: {
    reachable: boolean;
    serverVersion?: string;
    error?: string;
  };
}

export function LoginForm({ defaultDb, initialStatus }: LoginFormProps) {
  const router = useRouter();
  const { setUser } = useAuth();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [db, setDb] = useState(defaultDb);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = await apiFetch<{ user: OdooSessionUser }>("/api/odoo/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password, db }),
      });

      setUser(data.user);
      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to authenticate with Odoo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs">
          <span className="font-medium text-slate-600">Odoo Backend Status</span>
          {initialStatus.reachable ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
              {initialStatus.serverVersion ? ` (${initialStatus.serverVersion})` : ""}
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertCircle className="h-3.5 w-3.5" />
              Unreachable
            </Badge>
          )}
        </div>

        {!initialStatus.reachable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-medium">Odoo backend is not reachable yet.</p>
            <p className="mt-1 text-amber-800">
              Start Odoo locally with{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
                docker compose up -d
              </code>{" "}
              or configure <code className="font-mono">ODOO_BASE_URL</code> in{" "}
              <code className="font-mono">.env.local</code>.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="db"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Database
            </label>
            <div className="relative">
              <Database className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="db"
                name="db"
                type="text"
                value={db}
                onChange={(e) => setDb(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="odoo"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email / Username
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in to Odoo"
            )}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
