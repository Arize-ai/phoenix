import { getTimeZone, toLocalISOWithOffset } from "@phoenix/utils/timeUtils";

import type { UserMessageMetadata } from "./types";

/**
 * Build metadata stamped on an outgoing user message at send time.
 */
export function buildUserMessageMetadata(): UserMessageMetadata {
  const now = new Date();
  const timeZone = getTimeZone();
  return {
    type: "user",
    currentDateTime: toLocalISOWithOffset(now, timeZone),
    timeZone,
  };
}
