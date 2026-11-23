"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { OdooPartner, PaginatedResult } from "@/lib/odoo/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PartnersClientProps {
  initialData: PaginatedResult<OdooPartner>;
  initialError: string | null;
}

const PAGE_SIZE = 20;

export function PartnersClient({ initialData, initialError }: PartnersClientProps) {
  const [data, setData] = useState<PaginatedResult<OdooPartner>>(initialData);
  const [search, setSearch] = useState("");
  const [onlyCompanies, setOnlyCompanies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [isCompany, setIsCompany] = useState(false);

  const fetchPartners = async (
    nextSearch: string,
    nextOnlyCompanies: boolean,
    offset: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextOnlyCompanies) params.set("onlyCompanies", "true");

      const result = await apiFetch<PaginatedResult<OdooPartner>>(
        `/api/odoo/partners?${params.toString()}`
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load contacts."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    void fetchPartners(search, onlyCompanies, 0);
  };

  const handleToggleCompanies = (checked: boolean) => {
    setOnlyCompanies(checked);
    void fetchPartners(search, checked, 0);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await apiFetch<{ id: number }>("/api/odoo/partners", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone,
          city,
          is_company: isCompany,
        }),
      });

      setName("");
      setEmail("");
      setPhone("");
      setCity("");
      setIsCompany(false);
      setShowCreate(false);
      await fetchPartners(search, onlyCompanies, 0);
    } catch (err) {
      setCreateError(
        err instanceof ApiClientError ? err.message : "Failed to create contact in Odoo."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts by name or email..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyCompanies}
                  onChange={(e) => handleToggleCompanies(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-primary"
                />
                Companies only
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Search
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-primary-hover"
            >
              {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showCreate ? "Cancel" : "New Contact"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Create Contact Form */}
      {showCreate ? (
        <Card className="border-primary/30">
          <CardHeader
            title="Create Odoo Contact"
            description="Calls res.partner.create via POST /api/odoo/partners"
          />
          <CardContent>
            {createError ? (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            ) : null}

            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp or Jane Doe"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555-0100"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-between sm:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isCompany}
                    onChange={(e) => setIsCompany(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  Mark as company
                </label>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {creating ? "Creating..." : "Create in Odoo"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No contacts found matching your filter.
                  </td>
                </tr>
              ) : (
                data.items.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {partner.name}
                    </td>
                    <td className="px-5 py-3.5">
                      {partner.is_company ? (
                        <Badge variant="primary">
                          <Building2 className="h-3 w-3" />
                          Company
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          <User className="h-3 w-3" />
                          Individual
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {partner.email || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {partner.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {[partner.city || null, partner.country_id ? partner.country_id[1] : null]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            Showing <span className="font-medium text-slate-900">{data.offset + 1}</span>–
            <span className="font-medium text-slate-900">
              {Math.min(data.offset + data.items.length, data.total)}
            </span>{" "}
            of <span className="font-medium text-slate-900">{data.total}</span> contacts
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || data.offset === 0}
              onClick={() =>
                void fetchPartners(
                  search,
                  onlyCompanies,
                  Math.max(0, data.offset - PAGE_SIZE)
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={loading || data.offset + PAGE_SIZE >= data.total}
              onClick={() =>
                void fetchPartners(search, onlyCompanies, data.offset + PAGE_SIZE)
              }
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
