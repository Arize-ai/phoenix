import { toSDKParamsBase } from "./types";
import { type streamText } from "ai";

export type PartialStreamTextParams = Omit<
  Parameters<typeof streamText>[0],
  "model"
>;

export type ToAIParams = toSDKParamsBase;

/**
 * @todo
 */
export const toAI = ({
  prompt: _prompt,
}: ToAIParams): PartialStreamTextParams | null => {
  return null;
};
