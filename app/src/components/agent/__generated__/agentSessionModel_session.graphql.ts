/**
 * @generated SignedSource<<547c754f7f8ece9ec83d326d2463ac60>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
import { FragmentRefs } from "relay-runtime";
export type agentSessionModel_session$data = {
  readonly model: {
    readonly __typename: "AgentBuiltinProviderModelSelection";
    readonly modelName: string;
    readonly openaiApiType: OpenAIApiType;
    readonly provider: ModelProvider;
  } | {
    readonly __typename: "AgentCustomProviderModelSelection";
    readonly modelName: string;
    readonly providerId: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly " $fragmentType": "agentSessionModel_session";
};
export type agentSessionModel_session$key = {
  readonly " $data"?: agentSessionModel_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"agentSessionModel_session">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "agentSessionModel_session"
};

(node as any).hash = "2f64a7c5853a228fc81892e53fe55c5e";

export default node;
