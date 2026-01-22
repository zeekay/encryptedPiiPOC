/**
 * @convex-dev/encrypted-pii
 *
 * Type-safe encrypted PII field storage for Convex.
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
 * 2. Add PII fields to your schema:
 *
 * ```typescript
 * // convex/schema.ts
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
 *
 * 3. Encrypt and decrypt data:
 *
 * ```typescript
 * // convex/users.ts
 * import { mutation } from "./_generated/server";
 * import { EncryptedPII } from "@convex-dev/encrypted-pii";
 * import { components } from "./_generated/api";
 *
 * const encryptedPii = new EncryptedPII(components.encryptedPii);
 *
 * export const storePII = mutation({
 *   args: { userId: v.id("users"), ssn: v.string() },
 *   handler: async (ctx, args) => {
 *     const pii = await encryptedPii.forUser(ctx, args.userId);
 *
 *     await ctx.db.patch(args.userId, {
 *       ssn: await pii.encrypt(args.ssn),
 *     });
 *   },
 * });
 *
 * export const getPII = mutation({
 *   args: { userId: v.id("users") },
 *   handler: async (ctx, args) => {
 *     const pii = await encryptedPii.forUser(ctx, args.userId);
 *     const user = await ctx.db.get(args.userId);
 *
 *     return {
 *       ssn: await pii.decrypt(user?.ssn),
 *     };
 *   },
 * });
 * ```
 *
 * ## Type Safety
 *
 * The `piiField()` validator creates an object type that TypeScript won't
 * let you use as a string. This prevents accidentally displaying encrypted
 * data - you must call `pii.decrypt()` first.
 *
 * ```typescript
 * const user = await ctx.db.get(userId);
 *
 * // ❌ Type error - EncryptedField is not a string
 * console.log(`SSN: ${user.ssn}`);
 *
 * // ✅ Works - decrypt returns string
 * const ssn = await pii.decrypt(user.ssn);
 * console.log(`SSN: ${ssn}`);
 * ```
 */
export { EncryptedPII, UserPII, WrappedDb } from "./client.js";
export { piiField, isEncryptedField, extractPiiFields } from "./client.js";
