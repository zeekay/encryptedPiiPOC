/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    public: {
      deleteAllUserData: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string },
        number,
        Name
      >;
      deleteField: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        boolean,
        Name
      >;
      exists: FunctionReference<
        "query",
        "internal",
        { ownerId: string; ref: string },
        boolean,
        Name
      >;
      get: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        string | null,
        Name
      >;
      getBatch: FunctionReference<
        "mutation",
        "internal",
        { items: Array<{ ownerId: string; ref: string }> },
        Array<{ ref: string; value: string | null }>,
        Name
      >;
      getRawEncryptedData: FunctionReference<
        "query",
        "internal",
        { ownerId: string; ref: string },
        {
          algorithm: string;
          ciphertext: string;
          createdAt: number;
          encryptedDek: string;
          iv: string;
          ownerId: string;
          ref: string;
          version: number;
        } | null,
        Name
      >;
      getUserKey: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string },
        string,
        Name
      >;
      listRefs: FunctionReference<
        "query",
        "internal",
        { ownerId: string },
        Array<{ createdAt: number; ref: string }>,
        Name
      >;
      store: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; value: string },
        string,
        Name
      >;
    };
  };
