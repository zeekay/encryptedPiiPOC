import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Component schema for encrypted PII storage.
 *
 * Design for "hard to accidentally access":
 * - All encryption keys are stored encrypted (never plaintext)
 * - Master key is stored separately and only accessed internally
 * - Direct table queries only reveal ciphertext
 * - No functions expose raw key material
 */
export default defineSchema({
  /**
   * Stores encrypted field values.
   * Similar to how _storage stores file blobs, this stores encrypted data blobs.
   */
  encryptedFields: defineTable({
    // Unique reference ID (like storageId) - prefixed with "epii_"
    ref: v.string(),
    // User who owns this encrypted data - ONLY they can decrypt
    ownerId: v.string(),
    // Base64-encoded ciphertext (AES-GCM encrypted value)
    ciphertext: v.string(),
    // Base64-encoded DEK, encrypted with user's KEK
    encryptedDek: v.string(),
    // Base64-encoded initialization vector (12 bytes for AES-GCM)
    iv: v.string(),
    // Algorithm identifier for future-proofing
    algorithm: v.string(),
    // Version number for key rotation support
    version: v.number(),
  })
    .index("by_ref", ["ref"])
    .index("by_owner", ["ownerId"]),

  /**
   * Stores per-user Key Encryption Keys (KEKs).
   * Each user gets a unique KEK that encrypts their field DEKs.
   * The KEK itself is encrypted with the component master key.
   */
  userKeys: defineTable({
    userId: v.string(),
    // Base64-encoded KEK, encrypted with component master key
    encryptedKek: v.string(),
    // IV used to encrypt the KEK
    kekIv: v.string(),
    // Version for key rotation
    version: v.number(),
  }).index("by_user", ["userId"]),

  /**
   * Component master key - the root of the key hierarchy.
   *
   * This is the only unencrypted key, generated randomly on first use.
   * In a future version with client-side encryption, this table would
   * be empty and the master key would be provided by the client.
   *
   * We use a singleton pattern (single document with well-known ID).
   */
  masterKey: defineTable({
    // Base64-encoded 256-bit master key
    key: v.string(),
  }),
});
