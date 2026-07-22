import { graphql } from "react-relay";

import { extractCodeEvaluatorVariables } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { projectEvaluatorOptionsQuery$data } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateLLMProjectEvaluatorSlideover";
import { dropReferencePathMappings } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { generateMessageId } from "@phoenix/store";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

/**
 * The shared evaluator list feeding the project Add-evaluator menu and the
 * empty-state gallery. Both surfaces let a user copy an existing LLM evaluator
 * or attach an existing code evaluator, so they read from the same query.
 */
export const projectEvaluatorOptionsQuery = graphql`
  query projectEvaluatorOptionsQuery {
    evaluators(first: 100, sort: { col: updatedAt, dir: desc }) {
      edges {
        evaluator: node {
          __typename
          id
          name
          description
          kind
          ... on LLMEvaluator {
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
                threshold
                lowerBound
                upperBound
              }
            }
            promptVersion {
              templateFormat
              template {
                __typename
                ... on PromptChatTemplate {
                  messages {
                    ...promptUtils_promptMessages
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
            }
          }
          ... on CodeEvaluator {
            sourceCode
            language
            inputMapping {
              pathMapping
              literalMapping
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
                threshold
                lowerBound
                upperBound
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

export type ProjectEvaluatorOption =
  projectEvaluatorOptionsQuery$data["evaluators"]["edges"][number]["evaluator"];

/**
 * Build the creation mode for copying an existing LLM evaluator, or null when
 * its prompt template cannot be reconstructed.
 */
export function buildCopyLlmCreationMode(
  evaluator: ProjectEvaluatorOption
): ProjectEvaluatorCreationMode | null {
  const template = evaluator.promptVersion?.template;
  if (!template) return null;
  const defaultMessages =
    template.__typename === "PromptChatTemplate"
      ? convertPromptVersionMessagesToPlaygroundInstanceMessages({
          promptMessagesRefs: template.messages,
        })
      : template.__typename === "PromptStringTemplate"
        ? [
            {
              id: generateMessageId(),
              role: "user" as const,
              content: template.template,
            },
          ]
        : null;
  if (!defaultMessages) return null;
  return {
    kind: "copy",
    initialState: {
      name: evaluator.name,
      description: evaluator.description ?? "",
      outputConfigs: convertOutputConfigs(evaluator.outputConfigs ?? []),
      defaultMessages,
      templateFormat: evaluator.promptVersion?.templateFormat ?? "MUSTACHE",
      includeExplanation: inferIncludeExplanationFromPrompt(
        evaluator.promptVersion?.tools
      ),
    },
  };
}

/**
 * Build the creation mode for attaching an existing code evaluator.
 */
export function buildAttachCodeCreationMode(
  evaluator: ProjectEvaluatorOption
): ProjectEvaluatorCreationMode {
  const variables = extractCodeEvaluatorVariables({
    language: evaluator.language as CodeEvaluatorLanguage,
    sourceCode: evaluator.sourceCode ?? "",
  });
  return {
    kind: "code",
    evaluatorId: evaluator.id,
    name: evaluator.name,
    description: evaluator.description ?? "",
    inputMapping: dropReferencePathMappings(
      convertInputMapping(
        evaluator.inputMapping ?? { pathMapping: {}, literalMapping: {} }
      )
    ),
    outputConfigs: convertOutputConfigs(evaluator.outputConfigs ?? []),
    variables,
  };
}

function convertOutputConfigs(
  configs: ReadonlyArray<unknown>
): AnnotationConfig[] {
  const outputConfigs: AnnotationConfig[] = [];
  for (const unknownConfig of configs) {
    if (!isStringKeyedObject(unknownConfig)) continue;
    const config = unknownConfig;
    const name = typeof config.name === "string" ? config.name : null;
    const optimizationDirection = getOptimizationDirection(
      config.optimizationDirection
    );
    if (!name || !optimizationDirection) continue;
    if (
      config.__typename === "CategoricalAnnotationConfig" &&
      Array.isArray(config.values)
    ) {
      outputConfigs.push({
        name,
        optimizationDirection,
        values: config.values.flatMap((unknownValue) => {
          if (
            !isStringKeyedObject(unknownValue) ||
            typeof unknownValue.label !== "string"
          ) {
            return [];
          }
          return [
            {
              label: unknownValue.label,
              score:
                typeof unknownValue.score === "number"
                  ? unknownValue.score
                  : undefined,
            },
          ];
        }),
      });
      continue;
    }
    if (config.__typename === "ContinuousAnnotationConfig") {
      outputConfigs.push({
        name,
        optimizationDirection,
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      });
      continue;
    }
    if (config.__typename === "FreeformAnnotationConfig") {
      outputConfigs.push({
        name,
        optimizationDirection,
        threshold: getNullableNumber(config.threshold),
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      });
    }
  }
  return outputConfigs;
}

function getOptimizationDirection(
  value: unknown
): "MAXIMIZE" | "MINIMIZE" | "NONE" | null {
  return value === "MAXIMIZE" || value === "MINIMIZE" || value === "NONE"
    ? value
    : null;
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function convertInputMapping(inputMapping: {
  pathMapping: unknown;
  literalMapping: unknown;
}): EvaluatorInputMapping {
  const pathMapping = isStringKeyedObject(inputMapping.pathMapping)
    ? Object.fromEntries(
        Object.entries(inputMapping.pathMapping).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};
  const literalMapping = isStringKeyedObject(inputMapping.literalMapping)
    ? Object.fromEntries(
        Object.entries(inputMapping.literalMapping).filter(
          (entry): entry is [string, boolean | string | number] =>
            ["boolean", "string", "number"].includes(typeof entry[1])
        )
      )
    : {};
  return { pathMapping, literalMapping };
}
