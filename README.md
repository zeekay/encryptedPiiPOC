# @convex-dev/encrypted-pii

Encrypted field storage component for Convex. Store sensitive PII (SSN, credit cards, etc.) with per-user encryption keys.

## Features

- **Per-user encryption keys** - Each user gets their own Key Encryption Key (KEK)
- **Per-field encryption** - Each value has its own Data Encryption Key (DEK)
- **AES-256-GCM** - Industry-standard authenticated encryption
- **Storage-like API** - Familiar pattern: `store()` returns a ref, `get()` retrieves by ref
- **GDPR compliant** - `deleteAllUserData()` removes all encrypted data for a user
- **Batch operations** - `getBatch()` for efficient bulk decryption

## Installation

```bash
npm install @convex-dev/encrypted-pii
```

## Setup

### 1. Add the component to your Convex app

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import encryptedPii from "@convex-dev/encrypted-pii/convex.config";

const app = defineApp();
app.use(encryptedPii);

export default app;
```

### 2. Create the client

```typescript
// convex/pii.ts (or wherever you want)
import { EncryptedPII } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";

export const encryptedPii = new EncryptedPII(components.encryptedPii);
```

## Usage

### Storing encrypted data

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { encryptedPii } from "./pii";

export const storeSsn = mutation({
  args: {
    userId: v.id("users"),
    ssn: v.string(),
  },
  handler: async (ctx, args) => {
    // Encrypt and store - returns an opaque reference string
    const ssnRef = await encryptedPii.store(ctx, args.userId, args.ssn);

    // Store the reference in your document
    await ctx.db.patch(args.userId, { ssnRef });

    return ssnRef;
  },
});
```

### Retrieving encrypted data

```typescript
export const getDecryptedPii = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.ssnRef) return null;

    // Decrypt using the reference
    const ssn = await encryptedPii.get(ctx, args.userId, user.ssnRef);

    return { ssn };
  },
});
```

### Batch retrieval (recommended for multiple fields)

```typescript
export const getAllPii = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Decrypt multiple fields in one call
    const results = await encryptedPii.getBatch(ctx, [
      { ownerId: args.userId, ref: user.ssnRef },
      { ownerId: args.userId, ref: user.creditCardRef },
    ]);

    return {
      ssn: results[0].value,
      creditCard: results[1].value,
    };
  },
});
```

### Deleting encrypted data

```typescript
// Delete a single field
await encryptedPii.delete(ctx, userId, ssnRef);

// Delete ALL encrypted data for a user (GDPR "right to be forgotten")
const fieldsDeleted = await encryptedPii.deleteAllUserData(ctx, userId);
```

### Checking existence (without decrypting)

```typescript
// Check if a reference exists and belongs to a user (query, no decryption)
const exists = await encryptedPii.exists(ctx, userId, ssnRef);

// List all encrypted field references for a user
const refs = await encryptedPii.listRefs(ctx, userId);
// Returns: [{ ref: "epii_xxx", createdAt: 1234567890 }, ...]
```

## Schema integration

Store the encrypted field references as strings in your schema:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    // Encrypted PII references
    ssnRef: v.optional(v.string()),
    creditCardRef: v.optional(v.string()),
  }),
});
```

## API Reference

### `store(ctx, ownerId, value)`

Encrypt and store a value.

- `ctx` - Convex mutation context
- `ownerId` - String identifying the owner (typically user ID)
- `value` - Plaintext string to encrypt
- Returns: `EncryptedFieldRef` - opaque string to store in your document

### `get(ctx, ownerId, ref)`

Retrieve and decrypt a value.

- `ctx` - Convex mutation context
- `ownerId` - Must match the original owner
- `ref` - Reference returned by `store()`
- Returns: `string | null` - decrypted value, or null if not found/unauthorized

### `getBatch(ctx, items)`

Retrieve and decrypt multiple values efficiently.

- `ctx` - Convex mutation context
- `items` - Array of `{ ownerId, ref }`
- Returns: `Array<{ ref, value }>` - results in same order as input

### `delete(ctx, ownerId, ref)`

Delete an encrypted value.

- Returns: `boolean` - true if deleted

### `deleteAllUserData(ctx, ownerId)`

Delete ALL encrypted data for a user (GDPR compliance).

- Returns: `number` - count of fields deleted

### `exists(ctx, ownerId, ref)`

Check if a reference exists (query, no decryption).

- Returns: `boolean`

### `listRefs(ctx, ownerId)`

List all encrypted field references for a user.

- Returns: `Array<{ ref, createdAt }>`

### `getRawEncryptedData(ctx, ownerId, ref)`

Get raw encrypted data for debugging/demo purposes.

- Returns: `{ ref, ownerId, ciphertext, encryptedDek, iv, algorithm, version, createdAt } | null`

## Architecture

```
Master Key (1 per component instance)
    └── User KEK (1 per user)
            └── Field DEK (1 per encrypted value)
                    └── Encrypted Value (AES-256-GCM)
```

- **Master Key**: Generated once, encrypts all user KEKs
- **User KEK (Key Encryption Key)**: Per-user key that encrypts their field DEKs
- **Field DEK (Data Encryption Key)**: Per-value key for the actual encryption
- **Envelope Encryption**: DEKs are encrypted with KEKs, KEKs are encrypted with master key

## Security considerations

- Data is encrypted at rest with AES-256-GCM
- Each user has isolated encryption keys
- Only the owning user's ownerId can decrypt their data
- The component stores keys in isolated tables (separate from your app's data)

**Note**: This provides defense-in-depth but is server-side encryption. The Convex operator (and anyone with database access) could theoretically access the master key. For true zero-knowledge encryption, client-side encryption is required (not yet implemented).

## License

MIT
