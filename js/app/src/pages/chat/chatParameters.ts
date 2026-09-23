/**
 * The knobs the chat exposes for every model, regardless of provider: a
 * system prompt plus the sampling controls the AI SDK standardizes across
 * providers. `null` means "leave it to the model" — an unset parameter is
 * omitted from the request entirely, so models that pin or reject a control
 * (e.g. reasoning models that lock temperature) keep working untouched.
 */
export type ChatParameters = {
  /** Instructions sent as the system message. Blank sends none. */
  systemPrompt: string;
  temperature: number | null;
  topP: number | null;
  maxOutputTokens: number | null;
};

export const DEFAULT_CHAT_PARAMETERS: ChatParameters = {
  systemPrompt: "",
  temperature: null,
  topP: null,
  maxOutputTokens: null,
};

/**
 * Maps the chat parameters onto the AI SDK's call settings. Unset controls
 * map to `undefined`, which the SDK drops before the request is built.
 */
export function toChatCallSettings(parameters: ChatParameters): {
  system?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
} {
  return {
    system: parameters.systemPrompt.trim() || undefined,
    temperature: parameters.temperature ?? undefined,
    topP: parameters.topP ?? undefined,
    maxOutputTokens: parameters.maxOutputTokens ?? undefined,
  };
}
