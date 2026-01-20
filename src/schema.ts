/**
 * Schema helpers for encrypted PII fields.
 *
 * These helpers make it easy to mark fields as encrypted PII in your schema,
 * providing type safety and clear documentation of which fields contain sensitive data.
 *
 * Example usage:
 * ```typescript
 * import { defineSchema, defineTable } from "convex/server";
 * import { v } from "convex/values";
 * import { pii } from "@convex-dev/encrypted-pii/schema";
 *
 * export default defineSchema({
 *   users: defineTable({
 *     name: v.string(),
 *     email: v.string(),
 *     // PII fields - store the encrypted reference, not the actual data
 *     ssn: pii.field(),              // Required PII field
 *     passport: v.optional(pii.field()), // Optional PII field (can be omitted)
 *     driversLicense: pii.nullable(),    // Nullable PII field (null or string)
 *   }),
 * });
 * ```
 */

import { v, Validator } from "convex/values";

/**
 * PII field validators.
 * Use `pii.field()` for required fields, compose with `v.optional()` for optional.
 */
export const pii = {
  /**
   * Validator for an encrypted PII field reference.
   *
   * Use this in your schema to mark a field that will store a reference
   * to encrypted PII data. The actual sensitive data is stored in the
   * encrypted-pii component, not in your table.
   *
   * The reference is a string prefixed with "epii_" that uniquely
   * identifies the encrypted value.
   *
   * @example
   * ```typescript
   * ssn: pii.field(),                  // Required
   * passport: v.optional(pii.field()), // Optional (can be omitted)
   * ```
   */
  field(): Validator<string> {
    return v.string();
  },

  /**
   * Validator for a nullable PII field (can be null or a reference).
   * Use when the field must be present but may not have a value.
   *
   * @example
   * ```typescript
   * driversLicense: pii.nullable(), // Must be present, can be null
   * ```
   */
  nullable(): Validator<string | null> {
    return v.union(v.string(), v.null());
  },
};

// Legacy exports for backwards compatibility
export const piiField = pii.field;
export const piiFieldOptional = pii.nullable;

/**
 * Type for encrypted PII field references.
 * This is what gets stored in your documents - a reference to the
 * encrypted data, not the data itself.
 */
export type PIIFieldRef = string;

/**
 * Type guard to check if a string is a PII field reference.
 */
export function isPIIFieldRef(value: unknown): value is PIIFieldRef {
  return typeof value === "string" && value.startsWith("epii_");
}

/**
 * Extracts PII field names from a document type.
 * Useful for documentation and validation utilities.
 *
 * Note: This is a type-level utility. At runtime, you'll need to
 * explicitly list which fields are PII.
 */
export type PIIFields<T> = {
  [K in keyof T]: T[K] extends PIIFieldRef ? K : never;
}[keyof T];

/**
 * Helper to define which fields in a table are PII.
 * Use this to create a runtime list of PII fields for a table.
 *
 * @example
 * ```typescript
 * const userPIIFields = definePIIFields<Doc<"users">>()({
 *   ssn: true,
 *   passport: true,
 * });
 * // userPIIFields = ["ssn", "passport"]
 * ```
 */
export function definePIIFields<T>() {
  return <K extends keyof T>(fields: { [P in K]: true }): K[] => {
    return Object.keys(fields) as K[];
  };
}
