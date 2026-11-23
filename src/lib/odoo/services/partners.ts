import { odooCall, type OdooRpcOptions } from "../client";
import type { OdooDomain, OdooPartner, PaginatedResult } from "../types";

export const PARTNER_LIST_FIELDS = [
  "id",
  "name",
  "email",
  "phone",
  "city",
  "country_id",
  "is_company",
] as const;

export interface ListPartnersParams {
  search?: string;
  onlyCompanies?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreatePartnerInput {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  is_company?: boolean;
}

export function buildPartnerDomain(
  params: Pick<ListPartnersParams, "search" | "onlyCompanies">
): OdooDomain {
  const domain: OdooDomain = [["active", "=", true]];

  if (params.onlyCompanies) {
    domain.push(["is_company", "=", true]);
  }

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    domain.push("|", ["name", "ilike", trimmedSearch], ["email", "ilike", trimmedSearch]);
  }

  return domain;
}

export async function listPartners(
  sessionId: string,
  params: ListPartnersParams = {},
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<PaginatedResult<OdooPartner>> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const domain = buildPartnerDomain(params);

  const [items, total] = await Promise.all([
    odooCall<OdooPartner[]>(
      "res.partner",
      "search_read",
      [domain],
      {
        fields: [...PARTNER_LIST_FIELDS],
        limit,
        offset,
        order: "name asc",
      },
      { ...rpcOptions, sessionId }
    ),
    odooCall<number>(
      "res.partner",
      "search_count",
      [domain],
      {},
      { ...rpcOptions, sessionId }
    ),
  ]);

  return { items, total, limit, offset };
}

export async function createPartner(
  sessionId: string,
  input: CreatePartnerInput,
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<number> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    is_company: Boolean(input.is_company),
  };

  if (input.email?.trim()) {
    payload.email = input.email.trim();
  }
  if (input.phone?.trim()) {
    payload.phone = input.phone.trim();
  }
  if (input.city?.trim()) {
    payload.city = input.city.trim();
  }

  return odooCall<number>(
    "res.partner",
    "create",
    [payload],
    {},
    { ...rpcOptions, sessionId }
  );
}

export async function updatePartner(
  sessionId: string,
  id: number,
  input: Partial<CreatePartnerInput>,
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<boolean> {
  return odooCall<boolean>(
    "res.partner",
    "write",
    [[id], input],
    {},
    { ...rpcOptions, sessionId }
  );
}
