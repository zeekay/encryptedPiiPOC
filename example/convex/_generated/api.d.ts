/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  encryptedPii: {
    public: {
      deleteAllUserData: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string },
        number
      >;
      deleteField: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        boolean
      >;
      exists: FunctionReference<
        "query",
        "internal",
        { ownerId: string; ref: string },
        boolean
      >;
      get: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        string | null
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
        } | null
      >;
      listRefs: FunctionReference<
        "query",
        "internal",
        { ownerId: string },
        Array<{ createdAt: number; ref: string }>
      >;
      store: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; value: string },
        string
      >;
    };
  };
};
