import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Flex, Text, View } from "@phoenix/components";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import type { LLMDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_datasetEvaluator.graphql";
import {
  AnnotationCell,
  DatasetEvaluatorDetailsLayout,
  EvaluatorAnnotationsCard,
  InputMappingCard,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorDetailsLayout";
import { PromptLink } from "@phoenix/pages/evaluators/PromptCell";

export function LLMDatasetEvaluatorDetails({
  datasetEvaluatorRef,
}: {
  datasetEvaluatorRef: LLMDatasetEvaluatorDetails_datasetEvaluator$key;
}) {
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
                tools {
                  __typename
                  ... on PromptToolFunction {
                    function {
                      parameters
                    }
                  }
                  ... on PromptToolRaw {
                    raw
                  }
                }
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
          __typename
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
    <DatasetEvaluatorDetailsLayout
      main={
        <Card
          title="Prompt"
          extra={
            evaluator.promptVersion?.modelName ? (
              <Flex alignItems="center" gap="size-50">
                <GenerativeProviderIcon
                  provider={evaluator.promptVersion.modelProvider}
                  height={14}
                />
                <Text size="S" color="text-700">
                  {evaluator.promptVersion.modelName}
                </Text>
              </Flex>
            ) : undefined
          }
        >
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              {evaluator.prompt?.id && evaluator.prompt.name ? (
                <PromptLink
                  promptId={evaluator.prompt.id}
                  promptName={evaluator.prompt.name}
                  promptVersionTag={evaluator.promptVersionTag?.name}
                />
              ) : null}
              {evaluator.promptVersion && (
                <PromptChatMessages promptVersion={evaluator.promptVersion} />
              )}
            </Flex>
          </View>
        </Card>
      }
      aside={
        <>
          <EvaluatorAnnotationsCard
            configs={datasetEvaluator.outputConfigs}
            sharedCells={
              <AnnotationCell
                label="Explanations"
                value={includeExplanation ? "Enabled" : "Disabled"}
              />
            }
          />
          <InputMappingCard>
            <LLMEvaluatorInputMapping inputMapping={inputMapping} />
          </InputMappingCard>
        </>
      }
    />
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
    return (
      <Text size="S" color="text-500">
        No inputs mapped
      </Text>
    );
  }

  return (
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
  );
}
