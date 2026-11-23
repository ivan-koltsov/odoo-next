import { odooCall, type OdooRpcOptions } from "../client";
import type {
  OdooDomain,
  OdooProduct,
  OdooProductCategory,
  PaginatedResult,
} from "../types";

export const PRODUCT_LIST_FIELDS = [
  "id",
  "name",
  "list_price",
  "default_code",
  "barcode",
  "categ_id",
  "description_sale",
  "type",
] as const;

export interface ListProductsParams {
  search?: string;
  categoryId?: number;
  limit?: number;
  offset?: number;
}

export function buildProductDomain(params: Pick<ListProductsParams, "search" | "categoryId">): OdooDomain {
  const domain: OdooDomain = [["active", "=", true]];

  if (params.categoryId && Number.isInteger(params.categoryId) && params.categoryId > 0) {
    domain.push(["categ_id", "=", params.categoryId]);
  }

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    domain.push("|", ["name", "ilike", trimmedSearch], ["default_code", "ilike", trimmedSearch]);
  }

  return domain;
}

export async function listProducts(
  sessionId: string,
  params: ListProductsParams = {},
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<PaginatedResult<OdooProduct>> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const domain = buildProductDomain(params);

  const [items, total] = await Promise.all([
    odooCall<OdooProduct[]>(
      "product.product",
      "search_read",
      [domain],
      {
        fields: [...PRODUCT_LIST_FIELDS],
        limit,
        offset,
        order: "name asc",
      },
      { ...rpcOptions, sessionId }
    ),
    odooCall<number>(
      "product.product",
      "search_count",
      [domain],
      {},
      { ...rpcOptions, sessionId }
    ),
  ]);

  return { items, total, limit, offset };
}

export async function getProductById(
  sessionId: string,
  id: number,
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<OdooProduct | null> {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const records = await odooCall<OdooProduct[]>(
    "product.product",
    "search_read",
    [[["id", "=", id]]],
    {
      fields: [...PRODUCT_LIST_FIELDS, "active"],
      limit: 1,
    },
    { ...rpcOptions, sessionId }
  );

  return records[0] ?? null;
}

export async function listProductCategories(
  sessionId: string,
  rpcOptions: Omit<OdooRpcOptions, "sessionId"> = {}
): Promise<OdooProductCategory[]> {
  return odooCall<OdooProductCategory[]>(
    "product.category",
    "search_read",
    [[]],
    {
      fields: ["id", "name", "complete_name"],
      limit: 100,
      order: "complete_name asc",
    },
    { ...rpcOptions, sessionId }
  );
}
