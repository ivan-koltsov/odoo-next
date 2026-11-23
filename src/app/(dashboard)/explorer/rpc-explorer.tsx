"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";
import { ApiClientError, odooCall } from "@/lib/api/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Preset {
  label: string;
  model: string;
  method: string;
  args: string;
  kwargs: string;
}

const PRESETS: Preset[] = [
  {
    label: "Products (search_read)",
    model: "product.product",
    method: "search_read",
    args: '[[]]',
    kwargs: '{\n  "fields": ["id", "name", "list_price", "default_code"],\n  "limit": 10\n}',
  },
  {
    label: "Contacts (search_read)",
    model: "res.partner",
    method: "search_read",
    args: '[[]]',
    kwargs: '{\n  "fields": ["id", "name", "email", "is_company"],\n  "limit": 10\n}',
  },
  {
    label: "Installed Modules",
    model: "ir.module.module",
    method: "search_read",
    args: '[[["state", "=", "installed"]]]',
    kwargs: '{\n  "fields": ["name", "shortdesc", "latest_version"],\n  "limit": 20\n}',
  },
];

export function RpcExplorer() {
  const [model, setModel] = useState(PRESETS[1].model);
  const [method, setMethod] = useState(PRESETS[1].method);
  const [argsText, setArgsText] = useState(PRESETS[1].args);
  const [kwargsText, setKwargsText] = useState(PRESETS[1].kwargs);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  const applyPreset = (preset: Preset) => {
    setModel(preset.model);
    setMethod(preset.method);
    setArgsText(preset.args);
    setKwargsText(preset.kwargs);
    setError(null);
  };

  const handleRun = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setOutput(null);

    let parsedArgs: unknown[];
    let parsedKwargs: Record<string, unknown>;

    try {
      const a = JSON.parse(argsText);
      if (!Array.isArray(a)) {
        throw new Error("args must be a JSON array");
      }
      parsedArgs = a;
    } catch (err) {
      setError(`Invalid args JSON: ${err instanceof Error ? err.message : "parse error"}`);
      return;
    }

    try {
      const k = JSON.parse(kwargsText);
      if (typeof k !== "object" || k === null || Array.isArray(k)) {
        throw new Error("kwargs must be a JSON object");
      }
      parsedKwargs = k as Record<string, unknown>;
    } catch (err) {
      setError(`Invalid kwargs JSON: ${err instanceof Error ? err.message : "parse error"}`);
      return;
    }

    setRunning(true);
    try {
      const result = await odooCall(model, method, parsedArgs, parsedKwargs);
      setOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "JSON-RPC call failed."
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/40 hover:text-primary"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Call Parameters"
          description="Proxied through /api/odoo/call → /web/dataset/call_kw"
        />
        <CardContent>
          <form onSubmit={handleRun} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Model
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="res.partner"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Method
                </label>
                <input
                  type="text"
                  required
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="search_read"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  args (JSON Array)
                </label>
                <textarea
                  rows={5}
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  kwargs (JSON Object)
                </label>
                <textarea
                  rows={5}
                  value={kwargsText}
                  onChange={(e) => setKwargsText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? "Executing..." : "Run call_kw"}
            </button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {output !== null ? (
        <Card>
          <CardHeader title="Response" description="JSON-RPC result payload" />
          <CardContent>
            <pre className="max-h-112 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-100">
              {output}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
