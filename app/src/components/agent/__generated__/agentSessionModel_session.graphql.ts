/**
 * @generated SignedSource<<1f6dd6c281fb4008be5c70c12ce07174>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type agentSessionModel_session$data = {
  readonly model: {
    readonly __typename: "AgentBuiltinProviderModelSelection";
    readonly modelName: string;
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

(node as any).hash = "c175ed7c5f56f2a1075b6c5905e0ae79";

export default node;
