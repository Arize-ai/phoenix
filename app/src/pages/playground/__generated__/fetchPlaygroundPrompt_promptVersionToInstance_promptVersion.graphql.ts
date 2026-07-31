/**
 * @generated SignedSource<<83fba37a57de8885e8c72dee3af43b9d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
import { FragmentRefs } from "relay-runtime";
export type fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$data = {
  readonly customProvider: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly id: string;
  readonly invocationParameters: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
  };
  readonly modelName: string;
  readonly modelProvider: ModelProvider;
  readonly responseFormat: {
    readonly jsonSchema: {
      readonly description: string | null;
      readonly name: string;
      readonly schema: any | null;
      readonly strict: boolean | null;
    };
  } | null;
  readonly template: {
    readonly __typename: "PromptChatTemplate";
    readonly messages: ReadonlyArray<{
      readonly content: ReadonlyArray<{
        readonly __typename: string;
        readonly text?: {
          readonly text: string;
        };
        readonly toolCall?: {
          readonly toolCall: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly toolCallId: string;
        };
        readonly toolResult?: {
          readonly result: any;
          readonly toolCallId: string;
        };
        readonly " $fragmentSpreads": FragmentRefs<"mediaContentPartFragment">;
      }>;
      readonly role: PromptMessageRole;
    }>;
  } | {
    readonly __typename: "PromptStringTemplate";
    readonly template: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly tools: {
    readonly disableParallelToolCalls: boolean | null;
    readonly toolChoice: {
      readonly functionName: string | null;
      readonly type: PromptToolChoiceType;
    } | null;
    readonly tools: ReadonlyArray<{
      readonly __typename: "PromptToolFunction";
      readonly function: {
        readonly description: string | null;
        readonly name: string;
        readonly parameters: any;
        readonly strict: boolean | null;
      };
    } | {
      readonly __typename: "PromptToolRaw";
      readonly raw: any;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
  } | null;
  readonly " $fragmentType": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion";
};
export type fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key = {
  readonly " $data"?: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$data;
  readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion"
};

(node as any).hash = "eeb524887f846aa475c11f76161710c6";

export default node;
