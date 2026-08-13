import { z } from "zod";

import type { PendingGraphQLMutation } from "@phoenix/agent/chat/types";
import { isRecord } from "@phoenix/utils/typeUtils";

const pendingMutationSchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.unknown()).nullish(),
  digest: z.string(),
}) satisfies z.ZodType<PendingGraphQLMutation, PendingGraphQLMutation>;

/**
 * Reads the resolved GraphQL mutations awaiting user approval from a bash tool
 * part's `phoenix.pendingMutations` call provider metadata.
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
