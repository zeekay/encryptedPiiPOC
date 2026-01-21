/**
 * Key management for encrypted PII component.
 *
 * Key hierarchy:
 * - Master Key: Single key per component instance, encrypts all user KEKs
 * - User KEK: Per-user key that encrypts all their field DEKs
 * - Field DEK: Per-field key that encrypts the actual data
 *
 * Security design:
 * - Master key is stored in a separate table, only accessed by internal functions
 * - User KEKs are encrypted with master key before storage
 * - Field DEKs are encrypted with user KEK before storage
 * - No function ever returns raw key material to the caller
 */

import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";
import {
  generateKey,
  generateIV,
  wrapKey,
} from "./crypto.js";

/**
 * Get or create the component master key.
 * This is an internal function - never exposed to parent app.
 */
export const getOrCreateMasterKey = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("masterKey").first();
    if (existing) {
      return existing.key;
    }
    throw new Error("Master key not initialized. Call initializeMasterKey first.");
  },
});

/**
 * Initialize the master key if it doesn't exist.
 * Should be called on first use of the component.
 */
export const initializeMasterKey = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("masterKey").first();
    if (existing) {
      return null;
    }

    const masterKey = generateKey();
    await ctx.db.insert("masterKey", {
      key: masterKey,
    });
    return null;
  },
});

/**
 * Get the master key, initializing if needed.
 * Internal mutation that ensures master key exists.
 */
export const ensureMasterKey = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("masterKey").first();
    if (existing) {
      return existing.key;
    }

    const masterKey = generateKey();
    await ctx.db.insert("masterKey", {
      key: masterKey,
    });
    return masterKey;
  },
});

/**
 * Get or create a KEK for a user.
 * The KEK is returned encrypted with the master key - caller must unwrap it.
 */
export const getOrCreateUserKek = internalMutation({
  args: {
    userId: v.string(),
    masterKey: v.string(),
  },
  returns: v.object({
    encryptedKek: v.string(),
    kekIv: v.string(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return {
        encryptedKek: existing.encryptedKek,
        kekIv: existing.kekIv,
      };
    }

    const newKek = generateKey();
    const kekIv = generateIV();
    const encryptedKek = await wrapKey(newKek, args.masterKey, kekIv);

    await ctx.db.insert("userKeys", {
      userId: args.userId,
      encryptedKek,
      kekIv,
      version: 1,
    });

    return { encryptedKek, kekIv };
  },
});

/**
 * Get an existing user KEK (query-safe, doesn't create).
 * Returns null if the user has no key yet.
 */
export const getUserKekQuery = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      encryptedKek: v.string(),
      kekIv: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!existing) {
      return null;
    }

    return {
      encryptedKek: existing.encryptedKek,
      kekIv: existing.kekIv,
    };
  },
});

/**
 * Decrypt a user's KEK using the master key.
 * Internal only - returns the raw KEK for use in encryption/decryption.
 */
export { unwrapKey as decryptUserKek } from "./crypto.js";
