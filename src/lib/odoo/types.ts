export interface JsonRpcRequest<TParams = Record<string, unknown>> {
  jsonrpc: "2.0";
  method: "call";
  params: TParams;
  id: number;
}

export interface JsonRpcErrorData {
  name?: string;
  debug?: string;
  message?: string;
  arguments?: unknown[];
  context?: Record<string, unknown>;
}

export interface JsonRpcErrorPayload {
  code: number;
  message: string;
  data?: JsonRpcErrorData;
}

export interface JsonRpcResponse<TResult = unknown> {
  jsonrpc: "2.0";
  id: number | null;
  result?: TResult;
  error?: JsonRpcErrorPayload;
}

/**
 * Odoo represents Many2one relational fields as `[id, displayName]` or `false` when unset.
 */
export type OdooMany2One = [number, string] | false;

export type OdooDomainOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "like"
  | "ilike"
  | "not like"
  | "not ilike"
  | "=like"
  | "=ilike"
  | "in"
  | "not in"
  | "child_of"
  | "parent_of";

export type OdooDomainLeaf = [string, OdooDomainOperator, unknown];
export type OdooDomainToken = "&" | "|" | "!" | OdooDomainLeaf;
export type OdooDomain = OdooDomainToken[];

export interface OdooRawSessionInfo {
  uid: number | false;
  is_system?: boolean;
  is_admin?: boolean;
  name?: string;
  username?: string;
  db?: string;
  partner_id?: number | false;
  server_version?: string;
  user_companies?: {
    current_company?: number;
  };
  company_id?: number;
}

export interface OdooSessionUser {
  uid: number;
  name: string;
  username: string;
  db: string;
  partnerId: number | null;
  companyId: number | null;
  serverVersion: string | null;
  isAdmin: boolean;
  isSystem: boolean;
}

export interface OdooVersionInfo {
  server_version: string;
  server_version_info?: unknown[];
  protocol_version?: number;
}

export interface OdooProduct {
  id: number;
  name: string;
  list_price: number;
  default_code: string | false;
  barcode: string | false;
  categ_id: OdooMany2One;
  description_sale: string | false;
  type?: string;
  active?: boolean;
}

export interface OdooProductCategory {
  id: number;
  name: string;
  complete_name?: string;
}

export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  city: string | false;
  country_id: OdooMany2One;
  is_company: boolean;
  company_name?: string | false;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
