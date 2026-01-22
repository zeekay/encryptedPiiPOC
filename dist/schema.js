/**
 * Schema helpers for encrypted PII fields.
 */
import { v } from "convex/values";
/** Sentinel value indicating dev mode (not actually encrypted) */
export const DEV_MODE_MARKER = "DEVELOPMENT_MODE_NOT_ENCRYPTED";
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
    const validator = v.object({
        __encrypted: v.literal(true),
        v: v.number(),
        c: v.string(),
        i: v.string(),
        k: v.string(),
    });
    // Add runtime marker for detection by wrapDb
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validator.__isPiiField = true;
    return validator;
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
/**
 * Check if a validator has the __isPiiField marker.
 * Handles both direct piiField() and v.optional(piiField()).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPiiValidator(validator) {
    // Check for our __isPiiField marker
    if (validator?.__isPiiField)
        return true;
    // Check for v.optional(piiField()) - unwrap optional
    if (validator?.inner?.__isPiiField)
        return true;
    return false;
}
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPiiFields(schema) {
    const result = new Map();
    for (const [tableName, tableConfig] of Object.entries(schema.tables || {})) {
        const piiFields = new Set();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validator = tableConfig.validator;
        // Walk through validator fields to find __isPiiField markers
        if (validator?.fields) {
            for (const [fieldName, fieldValidator] of Object.entries(validator.fields)) {
                if (isPiiValidator(fieldValidator)) {
                    piiFields.add(fieldName);
                }
            }
        }
        if (piiFields.size > 0) {
            result.set(tableName, piiFields);
        }
    }
    return result;
}
