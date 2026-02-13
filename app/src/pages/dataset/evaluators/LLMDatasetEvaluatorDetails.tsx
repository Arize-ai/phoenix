import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { LLMDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { PromptLink } from "@phoenix/pages/evaluators/PromptCell";

export function LLMDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  datasetId,
  isEditSlideoverOpen,
  onEditSlideoverOpenChange,
}: {
  datasetEvaluatorRef: LLMDatasetEvaluatorDetails_datasetEvaluator$key;
  datasetId: string;
  isEditSlideoverOpen: boolean;
  onEditSlideoverOpenChange: (isOpen: boolean) => void;
}) {
  // this is so evaluator name updates are reflected in the breadcrumbs
  const { revalidate } = useRevalidator();
  const datasetEvaluator = useFragment(
    graphql`
      fragment LLMDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        inputMapping {
          literalMapping
          pathMapping
        }
        evaluator {
          kind
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersion {
              modelName
              modelProvider
              tools {
                definition
              }
              ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              ...PromptChatMessagesCard__main
            }
            promptVersionTag {
              name
            }
          }
        }
        outputConfigs {
          ... on CategoricalAnnotationConfig {
            name
            optimizationDirection
            values {
              label
              score
            }
          }
          ... on ContinuousAnnotationConfig {
            name
            optimizationDirection
            lowerBound
            upperBound
          }
        }
      }
    `,
    datasetEvaluatorRef
  );

  const evaluator = datasetEvaluator.evaluator;
  const inputMapping = datasetEvaluator.inputMapping;

  if (evaluator.kind !== "LLM") {
    throw new Error("LLMDatasetEvaluatorDetails called for non-LLM evaluator");
  }

  const includeExplanation = inferIncludeExplanationFromPrompt(
    evaluator.promptVersion?.tools
  );

  return (
    <>
      <Flex direction="column" gap="size-300">
        {datasetEvaluator.outputConfigs &&
          datasetEvaluator.outputConfigs.length > 0 &&
          (() => {
            const outputConfig = datasetEvaluator.outputConfigs[0];
            return (
              <Flex direction="column" gap="size-100">
                <Heading level={2}>Evaluator Annotation</Heading>
                <div
                  css={css`
                    background-color: var(--global-background-color-dark);
                    border-radius: var(--global-rounding-medium);
                    padding: var(--global-dimension-static-size-200);
                    margin-top: var(--global-dimension-static-size-50);
                    border: 1px solid var(--global-border-color-default);
                    overflow: hidden;
                  `}
                >
                  <Flex direction="column" gap="size-100">
                    <Truncate title={outputConfig.name}>
                      <Text size="S">
                        <Text weight="heavy">Name:</Text> {outputConfig.name}
                      </Text>
                    </Truncate>
                    {outputConfig.optimizationDirection && (
                      <Text size="S">
                        <Text weight="heavy">Optimization Direction:</Text>{" "}
                        {outputConfig.optimizationDirection}
                      </Text>
                    )}
                    {outputConfig.values && outputConfig.values.length > 0 && (
                      <Text>
                        <Text size="S" weight="heavy">
                          Values:{" "}
                        </Text>
                        {outputConfig.values.map((v, valIdx, arr) => (
                          <Text key={valIdx} size="S">
                            {v.label}
                            {v.score != null ? ` (${v.score})` : ""}
                            {valIdx < arr.length - 1 ? ", " : ""}
                          </Text>
                        ))}
                      </Text>
                    )}
                    <Text size="S">
                      <Text weight="heavy">Explanations:</Text>{" "}
                      {includeExplanation ? "Enabled" : "Disabled"}
                    </Text>
                  </Flex>
                </div>
              </Flex>
            );
          })()}
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Prompt</Heading>
          <Flex justifyContent="space-between" alignItems="center">
            {evaluator.prompt?.id && evaluator.prompt.name ? (
              <PromptLink
                promptId={evaluator.prompt.id}
                promptName={evaluator.prompt.name}
                promptVersionTag={evaluator.promptVersionTag?.name}
              />
            ) : (
              <div />
            )}
            {evaluator.promptVersion?.modelName && (
              <Flex alignItems="center" gap="size-50">
                <GenerativeProviderIcon
                  provider={evaluator.promptVersion.modelProvider}
                  height={14}
                />
                <Text size="S" color="text-700">
                  {evaluator.promptVersion.modelName}
                </Text>
              </Flex>
            )}
          </Flex>
          {evaluator.promptVersion && (
            <PromptChatMessages promptVersion={evaluator.promptVersion} />
          )}
        </Flex>
        <LLMEvaluatorInputMapping inputMapping={inputMapping} />
      </Flex>
      <EditLLMDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => {
          revalidate();
        }}
      />
    </>
  );
}

function LLMEvaluatorInputMapping({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: Record<string, boolean | string | number> | null;
    pathMapping?: Record<string, string> | null;
  } | null;
}) {
  const literalMapping = inputMapping?.literalMapping;
  const pathMapping = inputMapping?.pathMapping;

  const hasLiteralMapping =
    literalMapping && Object.keys(literalMapping).length > 0;
  const hasPathMapping = pathMapping && Object.keys(pathMapping).length > 0;

  if (!hasLiteralMapping && !hasPathMapping) {
    return null;
  }

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Input Mapping</Heading>
      <div
        css={css`
          background-color: var(--global-background-color-dark);
          border-radius: var(--global-rounding-medium);
          padding: var(--global-dimension-static-size-200);
          margin-top: var(--global-dimension-static-size-50);
          border: 1px solid var(--global-border-color-default);
        `}
      >
        <Flex direction="column" gap="size-100">
          {pathMapping &&
            Object.entries(pathMapping).map(([key, value]) => (
              <Text key={key} size="S">
                <Text weight="heavy">{key}:</Text> {value || "Not mapped"}
              </Text>
            ))}
          {literalMapping &&
            Object.entries(literalMapping).map(([key, value]) => (
              <Text key={key} size="S">
                <Text weight="heavy">{key}:</Text>{" "}
                {typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value)}
              </Text>
            ))}
        </Flex>
      </div>
    </Flex>
  );
}
