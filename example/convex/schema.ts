import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users with encrypted PII fields
  users: defineTable({
    name: v.string(),
    email: v.string(),
    // Encrypted PII - stored as string references (epii_xxx)
    // Only the owning user can decrypt these
    ssnRef: v.optional(v.string()),
    creditCardRef: v.optional(v.string()),
  }),
});
