import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/messages/messages";
import type { toSDKParamsBase } from "./types";

export type { MessageCreateParams };

export type ToAnthropicParams = toSDKParamsBase;

export const toAnthropic = ({
  prompt: _prompt,
}: ToAnthropicParams): MessageCreateParams | null => {
  return null;
};
