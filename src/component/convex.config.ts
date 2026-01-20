import { defineComponent } from "convex/server";

/**
 * Encrypted PII Component
 *
 * Provides encrypted field storage with per-user encryption keys.
 * Only the owning user can decrypt their data.
 *
 * Usage:
 * 1. Install: app.use(encryptedPii)
 * 2. Store: const ref = await encryptedPii.store(ctx, { ownerId, value })
 * 3. Get: const value = await encryptedPii.get(ctx, { ref, ownerId })
 */
const component = defineComponent("encryptedPii");

export default component;
