import { createClient } from "../client";
import type { ClientFn } from "../types/core";

/**
 * A secret to create, update, or delete.
 */
export interface SecretInput {
  /** The environment-style key used to identify the secret. */
  key: string;
  /** A value to create or update, or `null` to delete the key. */
  value: string | null;
}

/**
 * Parameters for atomically updating secrets.
 */
export interface UpsertOrDeleteSecretsParams extends ClientFn {
  /**
   * Ordered secret updates. When a key occurs more than once, the server
   * applies only its last occurrence.
   */
  secrets: SecretInput[];
}

/**
 * The names of the keys changed by a secrets update.
 *
 * Secret values are intentionally excluded.
 */
export interface UpsertOrDeleteSecretsResult {
  /** Keys that were created or updated. */
  upsertedKeys: string[];
  /** Keys that were deleted. */
  deletedKeys: string[];
}

/**
 * Atomically create, update, or delete a batch of Phoenix secrets.
 *
 * A non-null value creates or updates a secret, while `null` deletes it.
 * Duplicate keys use the last occurrence in the batch. The result contains
 * key names only; submitted values are never returned or logged.
 *
 * @param params - The secrets update.
 * @param params.client - Optional Phoenix client instance.
 * @param params.secrets - Ordered key/value-or-null updates.
 * @returns The names of the keys that were upserted and deleted.
 *
 * @example
 * ```ts
 * import { upsertOrDeleteSecrets } from "@arizeai/phoenix-client/secrets";
 *
 * const apiKey = process.env.OPENAI_API_KEY;
 * if (!apiKey) throw new Error("OPENAI_API_KEY is required");
 *
 * const result = await upsertOrDeleteSecrets({
 *   secrets: [
 *     { key: "OPENAI_API_KEY", value: apiKey },
 *     { key: "OLD_PROVIDER_API_KEY", value: null },
 *   ],
 * });
 * ```
 */
export async function upsertOrDeleteSecrets({
  client: _client,
  secrets,
}: UpsertOrDeleteSecretsParams): Promise<UpsertOrDeleteSecretsResult> {
  const client = _client ?? createClient();
  const { data, error } = await client.PUT("/v1/secrets", {
    body: { secrets },
  });

  // Do not include the server error payload here: validation responses can be
  // influenced by submitted data, which must never enter helper error text.
  if (error) {
    throw new Error("Failed to upsert or delete secrets");
  }

  if (!data?.data) {
    throw new Error("Failed to upsert or delete secrets: no data returned");
  }

  return {
    upsertedKeys: data.data.upserted_keys,
    deletedKeys: data.data.deleted_keys,
  };
}
