/**
 * @generated SignedSource<<932ad61f6559ee701f7086592ca6e51c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
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
    readonly definition: any;
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
  readonly tools: ReadonlyArray<{
    readonly definition: any;
  }>;
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

(node as any).hash = "68fb96bcc60939df0dc7e9fbb8238986";

export default node;
