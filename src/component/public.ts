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
import { decryptUserKek } from "./keys.js";
import { internal } from "./_generated/api.js";

/**
 * Store an encrypted field value.
 *
 * @param ownerId - The user who owns this data (only they can decrypt)
 * @param value - The plaintext value to encrypt and store
 * @returns A reference ID that can be used to retrieve the value
 */
export const store = mutation({
  args: {
    ownerId: v.string(),
    value: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // 1. Get or create master key
    const masterKey = await ctx.runMutation(internal.keys.ensureMasterKey, {});

    // 2. Get or create user's KEK
    const { encryptedKek, kekIv } = await ctx.runMutation(
      internal.keys.getOrCreateUserKek,
      { userId: args.ownerId, masterKey }
    );

    // 3. Decrypt the user's KEK
    const userKek = await decryptUserKek(encryptedKek, kekIv, masterKey);

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
      // Store both the encrypted DEK and its IV together
      encryptedDek: JSON.stringify({ dek: encryptedDek, dekIv }),
      iv: valueIv,
      algorithm: "AES-256-GCM",
      version: 1,
      _createdAt: Date.now(),
    });

    return ref;
  },
});

/**
 * Retrieve and decrypt a field value.
 *
 * @param ref - The reference ID returned by store()
 * @param ownerId - The user attempting to decrypt (must match the owner)
 * @returns The decrypted plaintext value, or null if not found/unauthorized
 */
export const get = mutation({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    // 1. Find the encrypted field
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    if (!field) {
      return null;
    }

    // 2. Verify ownership - CRITICAL security check
    if (field.ownerId !== args.ownerId) {
      // Don't reveal that the field exists - return null
      return null;
    }

    // 3. Get master key
    const masterKey = await ctx.runMutation(internal.keys.ensureMasterKey, {});

    // 4. Get user's KEK
    const { encryptedKek, kekIv } = await ctx.runMutation(
      internal.keys.getOrCreateUserKek,
      { userId: args.ownerId, masterKey }
    );

    // 5. Decrypt the user's KEK
    const userKek = await decryptUserKek(encryptedKek, kekIv, masterKey);

    // 6. Unwrap the field's DEK
    const { dek: encryptedDek, dekIv } = JSON.parse(field.encryptedDek);
    const fieldDek = await unwrapKey(encryptedDek, userKek, dekIv);

    // 7. Decrypt the value
    const plaintext = await decrypt(field.ciphertext, fieldDek, field.iv);

    return plaintext;
  },
});

/**
 * Delete an encrypted field.
 *
 * @param ref - The reference ID to delete
 * @param ownerId - The user attempting to delete (must match the owner)
 * @returns true if deleted, false if not found/unauthorized
 */
export const deleteField = mutation({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    if (!field) {
      return false;
    }

    // Verify ownership
    if (field.ownerId !== args.ownerId) {
      return false;
    }

    await ctx.db.delete(field._id);
    return true;
  },
});

/**
 * Delete ALL encrypted data for a user.
 * Useful for GDPR "right to be forgotten" compliance.
 *
 * @param ownerId - The user whose data should be deleted
 * @returns The number of fields deleted
 */
export const deleteAllUserData = mutation({
  args: {
    ownerId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const fields = await ctx.db
      .query("encryptedFields")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    for (const field of fields) {
      await ctx.db.delete(field._id);
    }

    // Also delete the user's KEK
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
 * Does NOT decrypt the data.
 */
export const exists = query({
  args: {
    ref: v.string(),
    ownerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const field = await ctx.db
      .query("encryptedFields")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .first();

    return field !== null && field.ownerId === args.ownerId;
  },
});

/**
 * List all encrypted field references for a user.
 * Does NOT return decrypted values.
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
      createdAt: f._createdAt,
    }));
  },
});
