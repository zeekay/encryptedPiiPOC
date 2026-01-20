/**
 * Example user mutations demonstrating encrypted PII usage.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { EncryptedPII } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";

// Create a single instance of the encrypted PII client
const encryptedPii = new EncryptedPII(components.encryptedPii);

/**
 * Create a new user with encrypted SSN.
 */
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    ssn: v.string(), // Plaintext SSN from client
  },
  handler: async (ctx, args) => {
    // First, create the user (we need the ID for encryption ownership)
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      ssnRef: "", // Temporary placeholder
      // passportRef is optional, can be omitted entirely
      driversLicenseRef: null, // nullable, must be present but can be null
    });

    // Encrypt the SSN with the user as owner
    // Only this user will be able to decrypt it later
    const ssnRef = await encryptedPii.store(ctx, userId, args.ssn);

    // Update the user with the encrypted reference
    await ctx.db.patch(userId, { ssnRef });

    return userId;
  },
});

/**
 * Get a user with decrypted PII.
 * Note: This is a mutation because decryption requires key operations.
 */
export const getUserWithPII = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Decrypt the SSN - only works because we're passing the correct owner
    const ssn = await encryptedPii.get(ctx, args.userId, user.ssnRef);

    // Optionally decrypt other PII fields if they exist
    let passport = null;
    if (user.passportRef) {
      passport = await encryptedPii.get(ctx, args.userId, user.passportRef);
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      // Decrypted PII
      ssn,
      passport,
    };
  },
});

/**
 * Get a user without decrypting PII (safe for listing).
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Return user without decrypted PII
    // The *Ref fields are opaque strings - not useful to display
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      hasSsn: !!user.ssnRef,
      hasPassport: !!user.passportRef,
    };
  },
});

/**
 * Update a user's SSN.
 */
export const updateSSN = mutation({
  args: {
    userId: v.id("users"),
    newSsn: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Delete the old encrypted SSN
    if (user.ssnRef) {
      await encryptedPii.delete(ctx, args.userId, user.ssnRef);
    }

    // Store the new encrypted SSN
    const ssnRef = await encryptedPii.store(ctx, args.userId, args.newSsn);

    // Update the user
    await ctx.db.patch(args.userId, { ssnRef });
  },
});

/**
 * Delete a user and all their encrypted PII.
 * GDPR "right to be forgotten" compliant.
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    // Delete ALL encrypted data for this user in one call
    // This removes all encrypted fields AND the user's encryption key
    const deletedCount = await encryptedPii.deleteAllUserData(ctx, args.userId);

    // Delete the user document
    await ctx.db.delete(args.userId);

    return { deletedPIIFields: deletedCount };
  },
});

/**
 * Add passport information to an existing user.
 */
export const addPassport = mutation({
  args: {
    userId: v.id("users"),
    passportNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Encrypt and store the passport number
    const passportRef = await encryptedPii.store(
      ctx,
      args.userId,
      args.passportNumber
    );

    await ctx.db.patch(args.userId, { passportRef });
  },
});
