import type { Metadata } from "next";
import { RpcExplorer } from "./rpc-explorer";

export const metadata: Metadata = {
  title: "RPC Explorer",
};

export default function ExplorerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          JSON-RPC Explorer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Test live <code className="font-mono text-xs">odooCall(model, method, args, kwargs)</code>{" "}
          requests through <code className="font-mono text-xs">POST /api/odoo/call</code>.
        </p>
      </div>

      <RpcExplorer />
    </div>
  );
}
