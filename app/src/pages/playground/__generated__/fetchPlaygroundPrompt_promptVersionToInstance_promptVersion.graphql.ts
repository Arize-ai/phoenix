/**
 * @generated SignedSource<<1ffb2d54f0edd697dcfb1a18c4b99ef9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
import { FragmentRefs } from "relay-runtime";
export type fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$data = {
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

(node as any).hash = "32e07f4440b74bd812bb76ef07ce018e";

export default node;
