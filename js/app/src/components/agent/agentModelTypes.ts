import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

/**
 * The assistant's model picker value. Extends the shared {@link ModelMenuValue}
 * with the ChatGPT (Codex) subscription flag, which only the assistant offers.
 * When set, `provider` is `OPENAI` for display purposes and the turn runs on
 * the browser's ChatGPT sign-in rather than on server-side OpenAI credentials.
 */
export type AgentModelMenuValue = ModelMenuValue & {
  codexSubscription?: boolean;
};
