/**
 * Schema helpers for encrypted PII fields.
 */
import { v } from "convex/values";

/**
 * The shape of an encrypted PII field stored in your documents.
 * This is an object (not a string) so TypeScript prevents accidental usage.
 */
export type EncryptedField = {
  /** Marker that identifies this as encrypted data */
  __encrypted: true;
  /** Version number for future migrations */
  v: number;
  /** Base64-encoded ciphertext (AES-256-GCM) */
  c: string;
  /** Base64-encoded initialization vector */
  i: string;
  /** Base64-encoded DEK, encrypted with user's KEK */
  k: string;
};

/**
 * Convex validator for encrypted PII fields.
 * Use this in your schema to get type-safe encrypted fields.
 *
 * @example
 * ```typescript
 * import { defineSchema, defineTable } from "convex/server";
 * import { v } from "convex/values";
 * import { piiField } from "@convex-dev/encrypted-pii";
 *
 * export default defineSchema({
 *   users: defineTable({
 *     name: v.string(),
 *     email: v.string(),
 *     ssn: v.optional(piiField()),
 *     creditCard: v.optional(piiField()),
 *   }),
 * });
 * ```
 */
export function piiField() {
  return v.object({
    __encrypted: v.literal(true),
    v: v.number(),
    c: v.string(),
    i: v.string(),
    k: v.string(),
  });
}

/**
 * Type guard to check if a value is an encrypted PII field.
 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    typeof value === "object" &&
    value !== null &&
    "__encrypted" in value &&
    (value as EncryptedField).__encrypted === true
  );
}
