/**
 * Schema helpers for encrypted PII fields.
 */
import { v } from "convex/values";
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
export function isEncryptedField(value) {
    return (typeof value === "object" &&
        value !== null &&
        "__encrypted" in value &&
        value.__encrypted === true);
}
