/**
 * Public API for encrypted PII storage.
 *
 * Mimics the Convex storage API pattern:
 * - store() returns a reference ID (like generateUploadUrl + storageId)
 * - get() retrieves and decrypts using the reference ID
 * - delete() removes the encrypted data
 *
 * Security: Only the owner (identified by ownerId) can decrypt their data.
 */

import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import {
  generateKey,
  generateIV,
  generateRef,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
} from "./crypto.js";
import { internal } from "./_generated/api.js";

/**
 * Store an encrypted field value.
 */
export const store = mutation({
  args: {
    ownerId: v.string(),
    value: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // 1. Get or create master key
    const masterKey = await ctx.runMutation(internal.keys.ensureMasterKey, {});

    // 2. Get or create user's KEK
    const { encryptedKek, kekIv } = await ctx.runMutation(
      internal.keys.getOrCreateUserKek,
      { userId: args.ownerId, masterKey }
    );

    // 3. Decrypt the user's KEK
    const userKek = await unwrapKey(encryptedKek, masterKey, kekIv);

    // 4. Generate a new DEK for this field
    const fieldDek = generateKey();
    const dekIv = generateIV();

    // 5. Encrypt the value with the DEK
    const valueIv = generateIV();
    const ciphertext = await encrypt(args.value, fieldDek, valueIv);

    // 6. Wrap (encrypt) the DEK with the user's KEK
    const encryptedDek = await wrapKey(fieldDek, userKek, dekIv);

    // 7. Generate a unique reference ID
    const ref = generateRef();

    // 8. Store everything
    await ctx.db.insert("encryptedFields", {
      ref,
      ownerId: args.ownerId,
      ciphertext,
      encryptedDek: JSON.stringify({ dek: encryptedDek, dekIv }),
      iv: valueIv,
      algorithm: "AES-256-GCM",
      version: 1,
    });

    return ref;
  },
});

/**
 * Retrieve and decrypt a field value.
 */
export const get = mutation({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    if (!field) {
      return null;
    }

    // Verify ownership - CRITICAL security check
    if (field.ownerId !== args.ownerId) {
      return null;
    }

    const masterKey = await ctx.runMutation(internal.keys.ensureMasterKey, {});
    const { encryptedKek, kekIv } = await ctx.runMutation(
      internal.keys.getOrCreateUserKek,
      { userId: args.ownerId, masterKey }
    );

    const userKek = await unwrapKey(encryptedKek, masterKey, kekIv);
    const { dek: encryptedDek, dekIv } = JSON.parse(field.encryptedDek);
    const fieldDek = await unwrapKey(encryptedDek, userKek, dekIv);
    const plaintext = await decrypt(field.ciphertext, fieldDek, field.iv);

    return plaintext;
  },
});

/**
 * Retrieve and decrypt multiple field values in a single call.
 * Optimized for performance - fetches user KEK once per unique owner.
 */
export const getBatch = mutation({
  args: {
    items: v.array(
      v.object({
        ref: v.string(),
        ownerId: v.string(),
      })
    ),
  },
  returns: v.array(
    v.object({
      ref: v.string(),
      value: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    if (args.items.length === 0) {
      return [];
    }

    // Get master key once
    const masterKey = await ctx.runMutation(internal.keys.ensureMasterKey, {});

    // Cache user KEKs by ownerId to avoid redundant lookups
    const userKekCache = new Map<string, string>();

    const results: Array<{ ref: string; value: string | null }> = [];

    for (const item of args.items) {
      // Fetch the encrypted field
      const field = await ctx.db
        .query("encryptedFields")
        .withIndex("by_ref", (q) => q.eq("ref", item.ref))
        .first();

      if (!field || field.ownerId !== item.ownerId) {
        results.push({ ref: item.ref, value: null });
        continue;
      }

      // Get or cache the user's KEK
      let userKek = userKekCache.get(item.ownerId);
      if (!userKek) {
        const { encryptedKek, kekIv } = await ctx.runMutation(
          internal.keys.getOrCreateUserKek,
          { userId: item.ownerId, masterKey }
        );
        userKek = await unwrapKey(encryptedKek, masterKey, kekIv);
        userKekCache.set(item.ownerId, userKek);
      }

      // Decrypt the field
      const { dek: encryptedDek, dekIv } = JSON.parse(field.encryptedDek);
      const fieldDek = await unwrapKey(encryptedDek, userKek, dekIv);
      const plaintext = await decrypt(field.ciphertext, fieldDek, field.iv);

      results.push({ ref: item.ref, value: plaintext });
    }

    return results;
  },
});

/**
 * Delete an encrypted field.
 */
export const deleteField = mutation({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    if (!field || field.ownerId !== args.ownerId) {
      return false;
    }

    await ctx.db.delete(field._id);
    return true;
  },
});

/**
 * Delete ALL encrypted data for a user (GDPR compliance).
 */
export const deleteAllUserData = mutation({
  args: {
    ownerId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const fields = await ctx.db
      .query("encryptedFields")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    for (const field of fields) {
      await ctx.db.delete(field._id);
    }

    const userKey = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.ownerId))
      .first();

    if (userKey) {
      await ctx.db.delete(userKey._id);
    }

    return fields.length;
  },
});

/**
 * Check if a reference exists and belongs to a user.
 */
export const exists = query({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    return field !== null && field.ownerId === args.ownerId;
  },
});

/**
 * List all encrypted field references for a user.
 */
export const listRefs = query({
  args: {
    ownerId: v.string(),
  },
  returns: v.array(
    v.object({
      ref: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const fields = await ctx.db
      .query("encryptedFields")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    return fields.map((f) => ({
      ref: f.ref,
      createdAt: f._creationTime,
    }));
  },
});

/**
 * Get the raw encrypted data for a field (for debugging/demo purposes).
 * Shows what's actually stored - ciphertext, IV, encrypted DEK.
 * Does NOT decrypt anything.
 */
export const getRawEncryptedData = query({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.union(
    v.object({
      ref: v.string(),
      ownerId: v.string(),
      ciphertext: v.string(),
      encryptedDek: v.string(),
      iv: v.string(),
      algorithm: v.string(),
      version: v.number(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    if (!field || field.ownerId !== args.ownerId) {
      return null;
    }

    return {
      ref: field.ref,
      ownerId: field.ownerId,
      ciphertext: field.ciphertext,
      encryptedDek: field.encryptedDek,
      iv: field.iv,
      algorithm: field.algorithm,
      version: field.version,
      createdAt: field._creationTime,
    };
  },
});
