export const ALLOWED_IMAGE_MODELS = [
  "product.product",
  "product.template",
  "res.partner",
  "res.users",
  "res.company",
] as const;

export const ALLOWED_IMAGE_FIELDS = [
  "image_128",
  "image_256",
  "image_512",
  "image_1024",
  "avatar_128",
] as const;

export type AllowedImageModel = (typeof ALLOWED_IMAGE_MODELS)[number];
export type AllowedImageField = (typeof ALLOWED_IMAGE_FIELDS)[number];

export interface ValidatedImageParams {
  model: AllowedImageModel;
  id: number;
  field: AllowedImageField;
}

const STRICT_POSITIVE_INT_RE = /^[1-9]\d*$/;

export function isAllowedImageModel(value: string): value is AllowedImageModel {
  return (ALLOWED_IMAGE_MODELS as readonly string[]).includes(value);
}

export function isAllowedImageField(value: string): value is AllowedImageField {
  return (ALLOWED_IMAGE_FIELDS as readonly string[]).includes(value);
}

export function validateImageParams(params: {
  model: string | null;
  id: string | null;
  field: string | null;
}): ValidatedImageParams | null {
  const model = params.model?.trim() ?? "";
  const field = params.field?.trim() || "image_256";
  const rawId = params.id?.trim() ?? "";

  if (!isAllowedImageModel(model)) {
    return null;
  }
  if (!isAllowedImageField(field)) {
    return null;
  }
  if (!STRICT_POSITIVE_INT_RE.test(rawId)) {
    return null;
  }

  const id = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return { model, id, field };
}

/**
 * Builds a proxied Next.js URL for resized Odoo images (e.g. `image_128`, `image_256`).
 */
export function getOdooImageUrl(
  model: AllowedImageModel,
  id: number,
  field: AllowedImageField = "image_256"
): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid record ID for Odoo image URL: ${id}`);
  }
  const query = new URLSearchParams({
    model,
    id: String(id),
    field,
  });
  return `/api/odoo/image?${query.toString()}`;
}
