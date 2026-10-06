import { useMemo } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Flex, Text, View } from "@phoenix/components";
import {
  getDeclaredInputBindings,
  inferIncludeExplanationFromPrompt,
} from "@phoenix/components/evaluators/utils";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { LLMDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_datasetEvaluator.graphql";
import {
  AnnotationCell,
  DatasetEvaluatorDetailsLayout,
  DeclaredInputMappingList,
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
              templateFormat
              template {
                __typename
                ... on PromptChatTemplate {
                  messages {
                    content {
                      ... on TextContentPart {
                        text {
                          text
                        }
                      }
                    }
                  }
                }
                ... on PromptStringTemplate {
                  template
                }
              }
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
  const promptVersion =
    evaluator.kind === "LLM" ? evaluator.promptVersion : null;
  const inputBindings = useMemo(() => {
    if (!promptVersion) {
      return [];
    }
    const { extractVariables } = getTemplateFormatUtils(
      promptVersion.templateFormat
    );
    const template = promptVersion.template;
    const texts =
      template.__typename === "PromptChatTemplate"
        ? template.messages.flatMap((message) =>
            message.content.flatMap((part) =>
              part.text ? [part.text.text] : []
            )
          )
        : template.__typename === "PromptStringTemplate"
          ? [template.template]
          : [];
    const variables = Array.from(new Set(texts.flatMap(extractVariables)));
    return getDeclaredInputBindings({
      variables,
      inputMapping: datasetEvaluator.inputMapping,
    });
  }, [promptVersion, datasetEvaluator.inputMapping]);

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
            <DeclaredInputMappingList bindings={inputBindings} />
          </InputMappingCard>
        </>
      }
    />
  );
}
