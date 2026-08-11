import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { PromptLink } from "@phoenix/pages/evaluators/PromptCell";
import { readPromptInvocationParameters } from "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";
import type {
  LLMProjectEvaluatorDetails_projectEvaluator$data,
  LLMProjectEvaluatorDetails_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/LLMProjectEvaluatorDetails_projectEvaluator.graphql";

const sectionCardCSS = css`
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
  margin-top: var(--global-dimension-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

/**
 * Read-only view of an LLM project evaluator's configuration: the annotation
 * it produces, the prompt and model it runs, and the span-to-prompt input
 * mapping. Mirrors LLMDatasetEvaluatorDetails, but a project evaluator keeps
 * its input mapping on the ProjectEvaluator rather than the evaluator itself.
 */
export function LLMProjectEvaluatorDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: LLMProjectEvaluatorDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment LLMProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {
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
              invocationParameters {
                ...PromptInvocationParametersReadableFragment
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
              ...PromptChatMessagesCard__main
            }
            promptVersionTag {
              name
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
              ... on FreeformAnnotationConfig {
                name
                optimizationDirection
              }
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );

  const evaluator = projectEvaluator.evaluator;
  const inputMapping = projectEvaluator.inputMapping;

  if (evaluator.kind !== "LLM") {
    throw new Error("LLMProjectEvaluatorDetails called for non-LLM evaluator");
  }

  const includeExplanation = inferIncludeExplanationFromPrompt(
    evaluator.promptVersion?.tools
  );
  const outputConfig = evaluator.outputConfigs?.[0];
  const invocationParameters = readPromptInvocationParameters(
    evaluator.promptVersion?.invocationParameters
  )?.parameters;
  const invocationParameterEntries = Object.entries(
    invocationParameters ?? {}
  ).filter(([, value]) => value != null);

  return (
    <Flex direction="column" gap="size-300">
      {outputConfig && (
        <EvaluatorAnnotationSection
          outputConfig={outputConfig}
          includeExplanation={includeExplanation}
        />
      )}
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
        {invocationParameterEntries.length > 0 && (
          <Flex justifyContent="end" gap="size-100" wrap>
            {invocationParameterEntries.map(([name, value]) => (
              <Text key={name} size="XS" color="text-700" fontFamily="mono">
                {name}:{" "}
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </Text>
            ))}
          </Flex>
        )}
        {evaluator.promptVersion && (
          <PromptChatMessages promptVersion={evaluator.promptVersion} />
        )}
      </Flex>
      <ProjectEvaluatorInputMapping inputMapping={inputMapping} />
    </Flex>
  );
}

type OutputConfig = NonNullable<
  LLMProjectEvaluatorDetails_projectEvaluator$data["evaluator"]["outputConfigs"]
>[number];

function EvaluatorAnnotationSection({
  outputConfig,
  includeExplanation,
}: {
  outputConfig: OutputConfig;
  includeExplanation: boolean;
}) {
  if (outputConfig.__typename === "%other") {
    return null;
  }
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Evaluator Annotation</Heading>
      <div css={sectionCardCSS}>
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
          {outputConfig.__typename === "CategoricalAnnotationConfig" &&
            outputConfig.values.length > 0 && (
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
          {outputConfig.__typename === "ContinuousAnnotationConfig" &&
            (outputConfig.lowerBound != null ||
              outputConfig.upperBound != null) && (
              <Text size="S">
                <Text weight="heavy">Range:</Text>{" "}
                {outputConfig.lowerBound ?? "-∞"} to{" "}
                {outputConfig.upperBound ?? "∞"}
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
}

function ProjectEvaluatorInputMapping({
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
      <div css={sectionCardCSS}>
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
