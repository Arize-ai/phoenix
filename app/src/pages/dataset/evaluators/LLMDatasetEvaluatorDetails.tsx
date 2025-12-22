import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { LLMDatasetEvaluatorDetails_evaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_evaluator.graphql";
import { PromptLink } from "@phoenix/pages/evaluators/PromptCell";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

export function LLMDatasetEvaluatorDetails({
  evaluatorRef,
}: {
  evaluatorRef: LLMDatasetEvaluatorDetails_evaluator$key;
}) {
  const evaluator = useFragment(
    graphql`
      fragment LLMDatasetEvaluatorDetails_evaluator on LLMEvaluator {
        kind
        prompt {
          id
          name
        }
        promptVersion {
          tools {
            definition
          }
          ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
        }
        promptVersionTag {
          name
        }
        outputConfig {
          name
          optimizationDirection
          values {
            label
            score
          }
        }
      }
    `,
    evaluatorRef
  );

  if (evaluator.kind !== "LLM") {
    throw new Error("LLMDatasetEvaluatorDetails called for non-LLM evaluator");
  }

  const includeExplanation = inferIncludeExplanationFromPrompt(
    evaluator.promptVersion?.tools
  );

  return (
    <EvaluatorPlaygroundProvider
      promptId={evaluator.prompt?.id}
      promptName={evaluator.prompt?.name}
      promptVersionRef={evaluator.promptVersion ?? undefined}
      promptVersionTag={evaluator.promptVersionTag?.name}
    >
      <EvaluatorStoreProvider
        initialState={{
          ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
          evaluator: {
            ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
            inputMapping: {
              literalMapping: {
                input: "Sample input",
                output: "Sample output",
                expected: "Sample expected",
              },
              pathMapping: {},
            },
          },
        }}
      >
        <View padding="size-200" overflow="auto">
          <Flex direction="column" gap="size-300">
            {evaluator.outputConfig && (
              <Flex direction="column" gap="size-100">
                <Heading level={2}>Evaluator Annotation</Heading>
                <div
                  css={css`
                    background-color: var(--ac-global-background-color-dark);
                    border-radius: var(--ac-global-rounding-medium);
                    padding: var(--ac-global-dimension-static-size-50);
                    margin-top: var(--ac-global-dimension-static-size-50);
                    border: 1px solid var(--ac-global-border-color-default);
                  `}
                >
                  <View padding="size-200">
                    <Flex direction="column" gap="size-100">
                      <Text size="S">
                        <Text weight="heavy">Name:</Text>{" "}
                        {evaluator.outputConfig.name}
                      </Text>
                      {evaluator.outputConfig.optimizationDirection && (
                        <Text size="S">
                          <Text weight="heavy">Optimization Direction:</Text>{" "}
                          {evaluator.outputConfig.optimizationDirection}
                        </Text>
                      )}
                      {evaluator.outputConfig.values &&
                        evaluator.outputConfig.values.length > 0 && (
                          <Text>
                            <Text size="S" weight="heavy">
                              Values:{" "}
                            </Text>
                            {evaluator.outputConfig.values.map((v, idx) => (
                              <Text key={idx} size="S">
                                {v.label}
                                {v.score != null ? ` (${v.score})` : ""}
                                {idx < evaluator.outputConfig.values.length - 1
                                  ? ", "
                                  : ""}
                              </Text>
                            ))}
                          </Text>
                        )}
                      <Text size="S">
                        <Text weight="heavy">Explanations:</Text>{" "}
                        {includeExplanation ? "Enabled" : "Disabled"}
                      </Text>
                    </Flex>
                  </View>
                </div>
              </Flex>
            )}
            <Flex direction="column" gap="size-100">
              <Flex justifyContent="space-between">
                <Heading level={2}>Prompt</Heading>
                <PromptLink
                  promptId={evaluator.prompt?.id}
                  promptName={evaluator.prompt?.name}
                  promptVersionTag={evaluator.promptVersionTag?.name}
                />
              </Flex>
              <EvaluatorPromptPreview />
            </Flex>
          </Flex>
        </View>
      </EvaluatorStoreProvider>
    </EvaluatorPlaygroundProvider>
  );
}
