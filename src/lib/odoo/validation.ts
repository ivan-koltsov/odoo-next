import { z } from "zod";
import { ALLOWED_IMAGE_FIELDS, ALLOWED_IMAGE_MODELS } from "./images";

export const ODOO_MODEL_REGEX = /^[a-z][a-z0-9_.]*$/i;
export const ODOO_METHOD_REGEX = /^[a-z][a-z0-9_]*$/i;
export const ODOO_DB_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
export const COOKIE_NAME_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
const POSITIVE_INT_STRING_REGEX = /^[1-9]\d*$/;
const NON_NEGATIVE_INT_STRING_REGEX = /^(?:0|[1-9]\d*)$/;

export const positiveIntIdSchema = z.union([
  z.number().int().positive("ID must be a positive integer"),
  z
    .string()
    .trim()
    .regex(POSITIVE_INT_STRING_REGEX, "ID must be a positive integer")
    .transform((val) => Number.parseInt(val, 10))
    .refine((val) => Number.isSafeInteger(val) && val > 0, "ID is out of range"),
]);

const optionalPositiveIntQuerySchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val === undefined || val === "" ? undefined : val))
  .refine(
    (val) => val === undefined || POSITIVE_INT_STRING_REGEX.test(val),
    "Must be a positive integer"
  )
  .transform((val) => (val === undefined ? undefined : Number.parseInt(val, 10)));

const paginationLimitSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val === undefined || val === "" ? "20" : val))
  .refine(
    (val) => POSITIVE_INT_STRING_REGEX.test(val),
    "limit must be an integer between 1 and 100"
  )
  .transform((val) => Number.parseInt(val, 10))
  .refine((val) => val >= 1 && val <= 100, "limit must be between 1 and 100");

const paginationOffsetSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val === undefined || val === "" ? "0" : val))
  .refine(
    (val) => NON_NEGATIVE_INT_STRING_REGEX.test(val),
    "offset must be a non-negative integer"
  )
  .transform((val) => Number.parseInt(val, 10))
  .refine((val) => Number.isSafeInteger(val) && val >= 0, "offset is out of range");

const booleanQuerySchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val === undefined || val === "" ? "false" : val.toLowerCase()))
  .refine(
    (val) => val === "true" || val === "false",
    "Must be 'true' or 'false'"
  )
  .transform((val) => val === "true");

export const odooConfigSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("ODOO_BASE_URL must be a valid HTTP(S) URL")
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "ODOO_BASE_URL must use http:// or https://")
    .transform((value) => value.replace(/\/+$/, "")),
  db: z
    .string()
    .trim()
    .regex(ODOO_DB_REGEX, "ODOO_DB contains invalid characters"),
  timeoutMs: z
    .number()
    .int("ODOO_TIMEOUT_MS must be an integer")
    .min(100, "ODOO_TIMEOUT_MS must be at least 100ms")
    .max(120_000, "ODOO_TIMEOUT_MS must not exceed 120000ms"),
  sessionCookieName: z
    .string()
    .trim()
    .regex(COOKIE_NAME_REGEX, "ODOO_SESSION_COOKIE_NAME is invalid"),
});

export const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Username or email is required")
    .max(255, "Username or email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(512, "Password is too long"),
  db: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === "" ? undefined : val))
    .refine(
      (val) => val === undefined || ODOO_DB_REGEX.test(val),
      "Database name contains invalid characters"
    ),
});

export const rpcCallSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1, "Model name is required")
    .max(128, "Model name is too long")
    .regex(ODOO_MODEL_REGEX, "Invalid Odoo model name"),
  method: z
    .string()
    .trim()
    .min(1, "Method name is required")
    .max(128, "Method name is too long")
    .regex(ODOO_METHOD_REGEX, "Invalid Odoo method name"),
  args: z.array(z.unknown()).optional().default([]),
  kwargs: z.record(z.string(), z.unknown()).optional().default({}),
});

export const productListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(200, "Search query must be 200 characters or fewer")
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  categoryId: optionalPositiveIntQuerySchema,
  limit: paginationLimitSchema,
  offset: paginationOffsetSchema,
});

export const partnerListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(200, "Search query must be 200 characters or fewer")
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  onlyCompanies: booleanQuerySchema,
  limit: paginationLimitSchema,
  offset: paginationOffsetSchema,
});

export const createPartnerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Contact name is required")
    .max(200, "Contact name must be 200 characters or fewer"),
  email: z
    .string()
    .trim()
    .max(254, "Email address is too long")
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number must be 50 characters or fewer")
    .regex(/^[+\d\s().-]*$/, "Phone number contains invalid characters")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .max(120, "City must be 120 characters or fewer")
    .optional()
    .or(z.literal("")),
  is_company: z.boolean().optional().default(false),
});

export const updatePartnerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Contact name cannot be empty")
      .max(200, "Contact name must be 200 characters or fewer")
      .optional(),
    email: z
      .string()
      .trim()
      .max(254, "Email address is too long")
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(50, "Phone number must be 50 characters or fewer")
      .regex(/^[+\d\s().-]*$/, "Phone number contains invalid characters")
      .optional()
      .or(z.literal("")),
    city: z
      .string()
      .trim()
      .max(120, "City must be 120 characters or fewer")
      .optional()
      .or(z.literal("")),
    is_company: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided for update" }
  );

export const imageQuerySchema = z.object({
  model: z.enum(ALLOWED_IMAGE_MODELS, {
    errorMap: () => ({ message: "Unsupported or disallowed Odoo image model" }),
  }),
  id: positiveIntIdSchema,
  field: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === undefined || val === "" ? "image_256" : val))
    .pipe(
      z.enum(ALLOWED_IMAGE_FIELDS, {
        errorMap: () => ({ message: "Unsupported or disallowed Odoo image field" }),
      })
    ),
});

export interface ValidationErrorBody {
  error: string;
  code: "INVALID_REQUEST";
  fieldErrors: Record<string, string[]>;
}

export function formatZodError(
  error: z.ZodError,
  fallbackMessage = "Invalid request parameters"
): ValidationErrorBody {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      fieldErrors[key] = messages;
    }
  }

  return {
    error: error.issues[0]?.message || fallbackMessage,
    code: "INVALID_REQUEST",
    fieldErrors,
  };
}
