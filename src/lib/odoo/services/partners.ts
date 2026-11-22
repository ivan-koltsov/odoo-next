import { odooCall, type OdooRpcOptions } from "../client";
import type { OdooDomain, OdooPartner, PaginatedResult } from "../types";
import {
  createPartnerSchema,
  positiveIntIdSchema,
  updatePartnerSchema,
} from "../validation";

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
  const validated = createPartnerSchema.parse(input);
  const payload: Record<string, unknown> = {
    name: validated.name,
    is_company: validated.is_company,
  };

  if (validated.email) {
    payload.email = validated.email;
  }
  if (validated.phone) {
    payload.phone = validated.phone;
  }
  if (validated.city) {
    payload.city = validated.city;
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
  const validatedId = positiveIntIdSchema.parse(id);
  const validated = updatePartnerSchema.parse(input);

  const payload: Record<string, unknown> = {};
  if (validated.name !== undefined) payload.name = validated.name;
  if (validated.email !== undefined) payload.email = validated.email || false;
  if (validated.phone !== undefined) payload.phone = validated.phone || false;
  if (validated.city !== undefined) payload.city = validated.city || false;
  if (validated.is_company !== undefined) payload.is_company = validated.is_company;

  return odooCall<boolean>(
    "res.partner",
    "write",
    [[validatedId], payload],
    {},
    { ...rpcOptions, sessionId }
  );
}
