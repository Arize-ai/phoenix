import type { CustomContentUIPart, ReasoningFileUIPart } from "ai";
import { isCustomContentUIPart, isReasoningFileUIPart } from "ai";

import type { AgentUIMessage } from "./types";

type ServerSafeUIPart = Exclude<
  AgentUIMessage["parts"][number],
  CustomContentUIPart | ReasoningFileUIPart
>;

/**
 * An {@link AgentUIMessage} without the part kinds introduced in ai SDK v7
 * (`custom` content and reasoning-file parts), matching the message shape the
 * Phoenix server's OpenAPI schema models.
 */
export type ServerSafeUIMessage = Omit<AgentUIMessage, "parts"> & {
  parts: ServerSafeUIPart[];
};

/**
 * Strip the part kinds introduced in ai SDK v7 (`CustomContentUIPart` and
 * `ReasoningFileUIPart`) from messages before sending them to the Phoenix
 * server, whose message schema does not model them.
 */
export function toServerSafeUIMessages(
  messages: AgentUIMessage[]
): ServerSafeUIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter(
      (part): part is ServerSafeUIPart =>
        !isCustomContentUIPart(part) && !isReasoningFileUIPart(part)
    ),
  }));
}
