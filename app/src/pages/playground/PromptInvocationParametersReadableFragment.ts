/**
 * Shared `@inline` fragment for the PromptInvocationParameters union (read path).
 * Consumers spread `...PromptInvocationParametersReadableFragment` in their
 * query and call {@link readPromptInvocationParameters} on the returned fragment
 * reference to get a `PromptInvocationParametersRecord` (camelCase).
 */
import { graphql, readInlineData } from "react-relay";

import type {
  PromptInvocationParametersReadableFragment$data,
  PromptInvocationParametersReadableFragment$key,
} from "./__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  type RawPromptInvocationParametersRecord,
  readPromptInvocationParametersUnion,
} from "./promptInvocationParameterCodecs";

const fragment = graphql`
  fragment PromptInvocationParametersReadableFragment on PromptInvocationParameters
  @inline {
    __typename
    ... on PromptOpenAIInvocationParameters {
      temperature
      openaiMaxTokens: maxTokens
      maxCompletionTokens
      frequencyPenalty
      presencePenalty
      topP
      seed
      stop
      reasoningEffort
      extraBody
    }
    ... on PromptAnthropicInvocationParameters {
      anthropicMaxTokens: maxTokens
      temperature
      topP
      stopSequences
      outputConfig {
        effort
      }
      thinking {
        __typename
        ... on PromptAnthropicThinkingDisabled {
          disabled
        }
        ... on PromptAnthropicThinkingEnabled {
          budgetTokens
          enabledDisplay: display
        }
        ... on PromptAnthropicThinkingAdaptive {
          adaptiveDisplay: display
        }
      }
      extraBody
    }
    ... on PromptGoogleInvocationParameters {
      temperature
      maxOutputTokens
      stopSequences
      presencePenalty
      frequencyPenalty
      topP
      topK
      thinkingConfig {
        thinkingBudget
        thinkingLevel
        includeThoughts
      }
    }
    ... on PromptAwsInvocationParameters {
      awsMaxTokens: maxTokens
      temperature
      topP
      stopSequences
    }
  }
`;

/**
 * Reads the invocation parameters fragment into the family-discriminated
 * bridge record. Returns `null` when the ref is null/undefined — callers that
 * want a default-empty record substitute `emptyPromptInvocationParametersRecord(family)`
 * since the family is only knowable from outside this read.
 */
export function readPromptInvocationParameters(
  ref: PromptInvocationParametersReadableFragment$key | null | undefined
): RawPromptInvocationParametersRecord | null {
  if (ref == null) return null;
  const data = readInlineData(fragment, ref);
  return readPromptInvocationParametersUnion(
    data as PromptInvocationParametersReadableFragment$data
  );
}
