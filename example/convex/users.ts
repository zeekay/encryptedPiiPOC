import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { EncryptedPII } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";

// Create a single instance of the encrypted PII client
const encryptedPii = new EncryptedPII(components.encryptedPii);

/**
 * List all users (without decrypted PII)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      hasSsn: !!user.ssnRef,
      hasCreditCard: !!user.creditCardRef,
    }));
  },
});

/**
 * Create a new user
 */
export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("users", {
      name: args.name,
      email: args.email,
    });
  },
});

/**
 * Store encrypted SSN for a user
 */
export const storeSsn = mutation({
  args: {
    userId: v.id("users"),
    ssn: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Delete old SSN if exists
    if (user.ssnRef) {
      await encryptedPii.delete(ctx, args.userId, user.ssnRef);
    }

    // Encrypt and store the new SSN
    const ssnRef = await encryptedPii.store(ctx, args.userId, args.ssn);
    await ctx.db.patch(args.userId, { ssnRef });

    return ssnRef;
  },
});

/**
 * Store encrypted credit card for a user
 */
export const storeCreditCard = mutation({
  args: {
    userId: v.id("users"),
    creditCard: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Delete old credit card if exists
    if (user.creditCardRef) {
      await encryptedPii.delete(ctx, args.userId, user.creditCardRef);
    }

    // Encrypt and store the new credit card
    const creditCardRef = await encryptedPii.store(ctx, args.userId, args.creditCard);
    await ctx.db.patch(args.userId, { creditCardRef });

    return creditCardRef;
  },
});

/**
 * Get decrypted PII for a user
 * In a real app, you'd verify the requesting user matches the owner
 */
export const getDecryptedPii = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    let ssn = null;
    let creditCard = null;

    if (user.ssnRef) {
      ssn = await encryptedPii.get(ctx, args.userId, user.ssnRef);
    }

    if (user.creditCardRef) {
      creditCard = await encryptedPii.get(ctx, args.userId, user.creditCardRef);
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      ssn,
      creditCard,
    };
  },
});

/**
 * Delete a user and all their encrypted PII
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { deleted: false, piiFieldsDeleted: 0 };

    // Delete all encrypted PII for this user
    const piiFieldsDeleted = await encryptedPii.deleteAllUserData(ctx, args.userId);

    // Delete the user
    await ctx.db.delete(args.userId);

    return { deleted: true, piiFieldsDeleted };
  },
});

/**
 * Get the raw encrypted references (to show they're just opaque strings)
 */
export const getRawRefs = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      ssnRef: user.ssnRef ?? null,
      creditCardRef: user.creditCardRef ?? null,
    };
  },
});

/**
 * Get the raw encrypted data (ciphertext, IV, etc.) for display
 */
export const getRawEncryptedData = query({
  args: {
    userId: v.id("users"),
    ref: v.string(),
  },
  handler: async (ctx, args) => {
    return encryptedPii.getRawEncryptedData(ctx, args.userId, args.ref);
  },
});
