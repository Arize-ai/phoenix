/**
 * @generated SignedSource<<003a17cfe91ed3f9643484f1b729d962>>
 * @lightSyntaxTransform
 * @nogrep
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
  readonly invocationParameters: any | null;
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
        readonly __typename: "TextContentPart";
        readonly text: {
          readonly text: string;
        };
      } | {
        readonly __typename: "ToolCallContentPart";
        readonly toolCall: {
          readonly toolCall: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly toolCallId: string;
        };
      } | {
        readonly __typename: "ToolResultContentPart";
        readonly toolResult: {
          readonly result: any;
          readonly toolCallId: string;
        };
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
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
      readonly function: {
        readonly description: string | null;
        readonly name: string;
        readonly parameters: any | null;
        readonly strict: boolean | null;
      };
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

(node as any).hash = "cccc93bf9101868d1ff7d1b69643490b";

export default node;
