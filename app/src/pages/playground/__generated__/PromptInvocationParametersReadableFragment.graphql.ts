/**
 * @generated SignedSource<<0d64962a205fe46770705be568d29ddc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnthropicOutputConfigEffort = "HIGH" | "LOW" | "MAX" | "MEDIUM" | "XHIGH";
export type AnthropicThinkingDisplay = "OMITTED" | "SUMMARIZED";
export type GoogleThinkingLevel = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL";
export type OpenAIReasoningEffort = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL" | "NONE" | "XHIGH";
import { FragmentRefs } from "relay-runtime";
export type PromptInvocationParametersReadableFragment$data = {
  readonly __typename: "PromptAnthropicInvocationParameters";
  readonly anthropicMaxTokens: number;
  readonly extraBody: any | null;
  readonly outputConfig: {
    readonly effort: AnthropicOutputConfigEffort | null;
  } | null;
  readonly stopSequences: ReadonlyArray<string> | null;
  readonly temperature: number | null;
  readonly thinking: {
    readonly __typename: "PromptAnthropicThinkingAdaptive";
    readonly adaptiveDisplay: AnthropicThinkingDisplay | null;
  } | {
    readonly __typename: "PromptAnthropicThinkingDisabled";
    readonly disabled: boolean;
  } | {
    readonly __typename: "PromptAnthropicThinkingEnabled";
    readonly budgetTokens: number;
    readonly enabledDisplay: AnthropicThinkingDisplay | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null;
  readonly topP: number | null;
  readonly " $fragmentType": "PromptInvocationParametersReadableFragment";
} | {
  readonly __typename: "PromptAwsInvocationParameters";
  readonly awsMaxTokens: number | null;
  readonly stopSequences: ReadonlyArray<string> | null;
  readonly temperature: number | null;
  readonly topP: number | null;
  readonly " $fragmentType": "PromptInvocationParametersReadableFragment";
} | {
  readonly __typename: "PromptGoogleInvocationParameters";
  readonly frequencyPenalty: number | null;
  readonly maxOutputTokens: number | null;
  readonly presencePenalty: number | null;
  readonly stopSequences: ReadonlyArray<string> | null;
  readonly temperature: number | null;
  readonly thinkingConfig: {
    readonly includeThoughts: boolean | null;
    readonly thinkingBudget: number | null;
    readonly thinkingLevel: GoogleThinkingLevel | null;
  } | null;
  readonly topK: number | null;
  readonly topP: number | null;
  readonly " $fragmentType": "PromptInvocationParametersReadableFragment";
} | {
  readonly __typename: "PromptOpenAIInvocationParameters";
  readonly extraBody: any | null;
  readonly frequencyPenalty: number | null;
  readonly maxCompletionTokens: number | null;
  readonly openaiMaxTokens: number | null;
  readonly presencePenalty: number | null;
  readonly reasoningEffort: OpenAIReasoningEffort | null;
  readonly seed: number | null;
  readonly stop: ReadonlyArray<string> | null;
  readonly temperature: number | null;
  readonly topP: number | null;
  readonly " $fragmentType": "PromptInvocationParametersReadableFragment";
} | {
  // This will never be '%other', but we need some
  // value in case none of the concrete values match.
  readonly __typename: "%other";
  readonly " $fragmentType": "PromptInvocationParametersReadableFragment";
};
export type PromptInvocationParametersReadableFragment$key = {
  readonly " $data"?: PromptInvocationParametersReadableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "PromptInvocationParametersReadableFragment"
};

(node as any).hash = "2e250a7d328e2712978fae7125bb2b84";

export default node;
