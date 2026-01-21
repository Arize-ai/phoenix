import { useState } from "react";
import { useFragment } from "react-relay";
import { useNavigate, useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import { PromptNameWithBadge } from "@phoenix/components/prompt";
import { PromptChatMessagesCard } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { LLMDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

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
  const [promptRefreshKey, setPromptRefreshKey] = useState(0);
  const navigate = useNavigate();
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
              id
              tools {
                definition
              }
              ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              ...PromptChatMessagesCard__main
              ...PromptModelConfigurationCard__main
            }
            promptVersionTag {
              name
            }
          }
        }
        outputConfig {
          ... on CategoricalAnnotationConfig {
            name
            optimizationDirection
            values {
              label
              score
            }
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

  const promptData =
    evaluator.prompt?.id &&
    evaluator.prompt?.name &&
    evaluator.promptVersion?.id
      ? {
          id: evaluator.prompt.id,
          name: evaluator.prompt.name,
          versionId: evaluator.promptVersion.id,
          tagName: evaluator.promptVersionTag?.name,
        }
      : null;

  const promptUrl = promptData?.tagName
    ? `/redirects/prompts/${promptData.id}/tags/${encodeURIComponent(promptData.tagName)}`
    : `/prompts/${promptData?.id}`;

  return (
    <EvaluatorPlaygroundProvider
      promptId={evaluator.prompt?.id}
      promptName={evaluator.prompt?.name}
      promptVersionRef={evaluator.promptVersion ?? undefined}
      promptVersionTag={evaluator.promptVersionTag?.name}
      // force remount when the evaluator prompt is updated in the slideover,
      // so that the prompt preview is updated
      key={promptRefreshKey}
    >
      <EvaluatorStoreProvider
        initialState={{
          ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
          evaluator: {
            ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
            inputMapping: {
              literalMapping: {
                ...inputMapping?.literalMapping,
                // this is so that mapped paths get rendered in the prompt preview
                ...inputMapping?.pathMapping,
              },
              pathMapping: {},
            },
          },
        }}
      >
        <View padding="size-200" overflow="auto">
          <Flex direction="column" gap="size-300">
            {datasetEvaluator.outputConfig && (
              <Flex direction="column" gap="size-100">
                <Heading level={2}>Evaluator Annotation</Heading>
                <div
                  css={css`
                    background-color: var(--ac-global-background-color-dark);
                    border-radius: var(--ac-global-rounding-medium);
                    padding: var(--ac-global-dimension-static-size-200);
                    margin-top: var(--ac-global-dimension-static-size-50);
                    border: 1px solid var(--ac-global-border-color-default);
                  `}
                >
                  <Flex direction="column" gap="size-100">
                    <Text size="S">
                      <Text weight="heavy">Name:</Text>{" "}
                      {datasetEvaluator.outputConfig.name}
                    </Text>
                    {datasetEvaluator.outputConfig.optimizationDirection && (
                      <Text size="S">
                        <Text weight="heavy">Optimization Direction:</Text>{" "}
                        {datasetEvaluator.outputConfig.optimizationDirection}
                      </Text>
                    )}
                    {datasetEvaluator.outputConfig.values &&
                      datasetEvaluator.outputConfig.values.length > 0 && (
                        <Text>
                          <Text size="S" weight="heavy">
                            Values:{" "}
                          </Text>
                          {datasetEvaluator.outputConfig.values.map(
                            (v, idx, arr) => (
                              <Text key={idx} size="S">
                                {v.label}
                                {v.score != null ? ` (${v.score})` : ""}
                                {idx < arr.length - 1 ? ", " : ""}
                              </Text>
                            )
                          )}
                        </Text>
                      )}
                    <Text size="S">
                      <Text weight="heavy">Explanations:</Text>{" "}
                      {includeExplanation ? "Enabled" : "Disabled"}
                    </Text>
                  </Flex>
                </div>
              </Flex>
            )}
            {promptData && (
              <Flex direction="column" gap="size-200">
                <Flex direction="column" gap="size-100">
                  <Heading level={2}>Prompt</Heading>
                  <div
                    css={css`
                      cursor: pointer;
                      &:hover button {
                        background-color: var(
                          --ac-global-input-field-background-color-hover
                        );
                      }
                    `}
                    onClick={() => navigate(promptUrl)}
                    role="button"
                  >
                    <Flex
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <PromptNameWithBadge
                        name={promptData.name}
                        {...(promptData.tagName
                          ? { tag: promptData.tagName }
                          : { versionId: promptData.versionId })}
                      />
                      <Button
                        size="S"
                        leadingVisual={
                          <Icon svg={<Icons.MessageSquareOutline />} />
                        }
                        onPress={() => navigate(promptUrl)}
                      >
                        View prompt
                      </Button>
                    </Flex>
                  </div>
                </Flex>
                <PromptChatMessagesCard
                  title="Prompt Template"
                  promptVersion={evaluator.promptVersion!}
                />
                <LLMEvaluatorInputMapping inputMapping={inputMapping} />
                <PromptModelConfigurationCard
                  promptVersion={evaluator.promptVersion!}
                />
              </Flex>
            )}
          </Flex>
        </View>
      </EvaluatorStoreProvider>
      <EditLLMDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => {
          setPromptRefreshKey((prev) => prev + 1);
          revalidate();
        }}
      />
    </EvaluatorPlaygroundProvider>
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
          background-color: var(--ac-global-background-color-dark);
          border-radius: var(--ac-global-rounding-medium);
          padding: var(--ac-global-dimension-static-size-200);
          margin-top: var(--ac-global-dimension-static-size-50);
          border: 1px solid var(--ac-global-border-color-default);
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
