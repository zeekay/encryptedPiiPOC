/**
 * Schema helpers for encrypted PII fields.
 *
 * For encrypted PII fields, use `v.string()` in your schema - the encrypted
 * reference is stored as a string prefixed with "epii_".
 *
 * Example usage:
 * ```typescript
 * import { defineSchema, defineTable } from "convex/server";
 * import { v } from "convex/values";
 *
 * export default defineSchema({
 *   users: defineTable({
 *     name: v.string(),
 *     email: v.string(),
 *     // PII fields - store the encrypted reference (v.string())
 *     ssnRef: v.string(),              // Required PII field
 *     passportRef: v.optional(v.string()), // Optional PII field
 *   }),
 * });
 * ```
 */
/**
 * Type guard to check if a string is a PII field reference.
 */
export function isPIIFieldRef(value) {
    return typeof value === "string" && value.startsWith("epii_");
}
/**
 * Helper to define which fields in a table are PII.
 * Use this to create a runtime list of PII fields for a table.
 *
 * @example
 * ```typescript
 * const userPIIFields = definePIIFields(["ssnRef", "passportRef"]);
 * ```
 */
export function definePIIFields(fields) {
    return fields;
}
