/**
 * Shared `@inline` fragment for the PromptInvocationParameters union (read path).
 * Consumers spread `...PromptInvocationParametersReadableFragment` in their
 * query and call {@link readPromptInvocationParameters} on the returned fragment
 * reference to get a display-friendly invocation parameter record.
 */
import { graphql, readInlineData } from "react-relay";

import type {
  PromptInvocationParametersReadableFragment$data,
  PromptInvocationParametersReadableFragment$key,
} from "./__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  type PromptInvocationParameterDisplayRecord,
  promptInvocationDataToDisplayRecord,
} from "./providerAdapters";

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
 * Reads the invocation parameters fragment into the family-discriminated display
 * record. Returns `null` when the ref is null/undefined.
 */
export function readPromptInvocationParameters(
  ref: PromptInvocationParametersReadableFragment$key | null | undefined
): PromptInvocationParameterDisplayRecord | null {
  if (ref == null) return null;
  const data = readInlineData(fragment, ref);
  return promptInvocationDataToDisplayRecord(
    data as PromptInvocationParametersReadableFragment$data
  );
}

/**
 * Reads the invocation parameters fragment into the raw GraphQL union data
 * (still typed-by-`__typename`), without converting to the bridge record.
 * Provider adapters consume this directly via `fromPromptInvocationParameters`.
 */
export function readPromptInvocationParametersData(
  ref: PromptInvocationParametersReadableFragment$key | null | undefined
): PromptInvocationParametersReadableFragment$data | null {
  if (ref == null) return null;
  return readInlineData(
    fragment,
    ref
  ) as PromptInvocationParametersReadableFragment$data;
}
