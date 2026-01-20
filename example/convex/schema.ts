/**
 * Example schema using encrypted PII fields.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { pii } from "@convex-dev/encrypted-pii/schema";

export default defineSchema({
  users: defineTable({
    // Regular fields - stored as plaintext
    name: v.string(),
    email: v.string(),

    // PII fields - store references to encrypted data
    // The actual values are encrypted in the component's isolated storage
    ssnRef: pii.field(),                    // Required
    passportRef: v.optional(pii.field()),   // Optional (can be omitted)
    driversLicenseRef: pii.nullable(),      // Nullable (must be present, can be null)
  }),

  // Example: medical records with encrypted sensitive fields
  medicalRecords: defineTable({
    userId: v.id("users"),
    visitDate: v.number(),

    // Regular fields
    doctorName: v.string(),
    facilityName: v.string(),

    // Encrypted PII
    diagnosisRef: pii.field(),
    notesRef: v.optional(pii.field()),
  }).index("by_user", ["userId"]),
});
