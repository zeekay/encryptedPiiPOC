/** Sentinel value indicating dev mode (not actually encrypted) */
export declare const DEV_MODE_MARKER = "DEVELOPMENT_MODE_NOT_ENCRYPTED";
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
export declare function piiField(): import("convex/values").VObject<{
    __encrypted: true;
    v: number;
    c: string;
    i: string;
    k: string;
}, {
    __encrypted: import("convex/values").VLiteral<true, "required">;
    v: import("convex/values").VFloat64<number, "required">;
    c: import("convex/values").VString<string, "required">;
    i: import("convex/values").VString<string, "required">;
    k: import("convex/values").VString<string, "required">;
}, "required", "__encrypted" | "v" | "c" | "i" | "k">;
/**
 * Type guard to check if a value is an encrypted PII field.
 */
export declare function isEncryptedField(value: unknown): value is EncryptedField;
/**
 * Extract PII field names from a Convex schema.
 * Returns a Map from table name to Set of PII field names.
 *
 * @param schema - A Convex schema created with defineSchema()
 * @returns Map from table name to Set of field names that use piiField()
 *
 * @example
 * ```typescript
 * import schema from "./schema";
 * import { extractPiiFields } from "@convex-dev/encrypted-pii";
 *
 * const piiFields = extractPiiFields(schema);
 * // Map { "users" => Set { "ssn", "creditCard" } }
 * ```
 */
export declare function extractPiiFields(schema: any): Map<string, Set<string>>;
//# sourceMappingURL=schema.d.ts.map