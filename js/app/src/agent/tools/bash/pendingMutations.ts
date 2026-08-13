import { z } from "zod";

import type { PendingGraphQLMutation } from "@phoenix/agent/chat/types";
import { isRecord } from "@phoenix/utils/typeUtils";

const pendingMutationSchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.unknown()).nullish(),
  digest: z.string(),
});

/**
 * Reads the resolved GraphQL mutations awaiting user approval from a bash tool
 * part's `phoenix.pendingMutations` call provider metadata.
 *
 * This is the reload-time source: the server stamps the payload onto the
 * persisted part. During a live stream the same payload arrives as a
 * `data-bash-mutation-approval` chunk and is read from the agent store
 * instead, because the part's metadata was already emitted by the time the
 * `phoenix-gql` builtin resolves the mutations.
 */
export function getBashToolPendingMutations(part: {
  callProviderMetadata?: unknown;
}): PendingGraphQLMutation[] | null {
  const phoenixMetadata: unknown = isRecord(part.callProviderMetadata)
    ? part.callProviderMetadata.phoenix
    : null;
  if (!isRecord(phoenixMetadata)) {
    return null;
  }
  const parsed = z
    .array(pendingMutationSchema)
    .safeParse(phoenixMetadata.pendingMutations);
  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }
  return parsed.data;
}
