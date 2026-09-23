import { getTimeZone, toLocalISOWithOffset } from "@phoenix/utils/timeUtils";

import type { AgentMessageMetadata } from "./types";

/**
 * Build metadata stamped on an outgoing user message at send time.
 */
export function buildUserMessageMetadata(): AgentMessageMetadata {
  const now = new Date();
  const timeZone = getTimeZone();
  return {
    phoenix: {
      type: "user",
      currentDateTime: toLocalISOWithOffset(now, timeZone),
      timeZone,
    },
  };
}
