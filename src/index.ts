/**
 * @convex-dev/encrypted-pii
 *
 * Encrypted PII field storage component for Convex.
 * Provides a storage-like API for encrypting sensitive user data
 * where only the owning user can decrypt.
 *
 * ## Quick Start
 *
 * 1. Install and configure the component:
 *
 * ```typescript
 * // convex/convex.config.ts
 * import { defineApp } from "convex/server";
 * import encryptedPii from "@convex-dev/encrypted-pii/convex.config";
 *
 * const app = defineApp();
 * app.use(encryptedPii);
 * export default app;
 * ```
 *
 * 2. Use PII field helpers in your schema:
 *
 * ```typescript
 * // convex/schema.ts
 * import { defineSchema, defineTable } from "convex/server";
 * import { v } from "convex/values";
 * import { pii } from "@convex-dev/encrypted-pii/schema";
 *
 * export default defineSchema({
 *   users: defineTable({
 *     name: v.string(),
 *     email: v.string(),
 *     ssnRef: pii.field(),                  // Required encrypted field
 *     passportRef: v.optional(pii.field()), // Optional (can be omitted)
 *   }),
 * });
 * ```
 *
 * 3. Store and retrieve encrypted data:
 *
 * ```typescript
 * // convex/users.ts
 * import { mutation, query } from "./_generated/server";
 * import { EncryptedPII } from "@convex-dev/encrypted-pii";
 * import { components } from "./_generated/api";
 *
 * const encryptedPii = new EncryptedPII(components.encryptedPii);
 *
 * export const createUser = mutation({
 *   args: { name: v.string(), email: v.string(), ssn: v.string() },
 *   handler: async (ctx, args) => {
 *     const userId = await ctx.db.insert("users", {
 *       name: args.name,
 *       email: args.email,
 *       ssnRef: "", // Placeholder
 *     });
 *
 *     // Encrypt the SSN with the user as owner
 *     const ssnRef = await encryptedPii.store(ctx, userId, args.ssn);
 *
 *     // Update with the encrypted reference
 *     await ctx.db.patch(userId, { ssnRef });
 *
 *     return userId;
 *   },
 * });
 *
 * export const getUser = mutation({
 *   args: { userId: v.id("users") },
 *   handler: async (ctx, args) => {
 *     const user = await ctx.db.get(args.userId);
 *     if (!user) return null;
 *
 *     // Decrypt the SSN (only works if caller is the owner)
 *     const ssn = await encryptedPii.get(ctx, args.userId, user.ssnRef);
 *
 *     return { ...user, ssn };
 *   },
 * });
 * ```
 *
 * ## Security Model
 *
 * - Each user gets a unique Key Encryption Key (KEK)
 * - Each field gets a unique Data Encryption Key (DEK)
 * - DEKs are encrypted with the user's KEK
 * - KEKs are encrypted with a component master key
 * - Only the owning user can decrypt their data
 *
 * ## Migration Path to Client-Side Encryption
 *
 * This component is designed to eventually support client-side encryption
 * where keys are derived from user passwords and never touch the server.
 * The current server-side key management is a stepping stone that provides:
 * - Immediate encryption at rest
 * - Per-user key isolation
 * - API compatibility with future client-side encryption
 */

export { EncryptedPII, type EncryptedFieldRef, type PIIRef } from "./client.js";
