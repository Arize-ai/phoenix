import { graphql, readInlineData } from "react-relay";

import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { projectEvaluatorDetailsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsQuery.graphql";
import type {
  projectEvaluatorOptions_codeEvaluatorDetails$data,
  projectEvaluatorOptions_codeEvaluatorDetails$key,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptions_codeEvaluatorDetails.graphql";
import type {
  projectEvaluatorOptions_llmEvaluatorDetails$data,
  projectEvaluatorOptions_llmEvaluatorDetails$key,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptions_llmEvaluatorDetails.graphql";
import type { projectEvaluatorOptionsQuery$data } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { generateMessageId } from "@phoenix/store";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

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
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const llmProjectEvaluatorDetailsFragment = graphql`
  fragment projectEvaluatorOptions_llmEvaluatorDetails on LLMEvaluator @inline {
    __typename
    id
    name
    description
    kind
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
`;

const codeProjectEvaluatorDetailsFragment = graphql`
  fragment projectEvaluatorOptions_codeEvaluatorDetails on CodeEvaluator
  @inline {
    __typename
    id
    name
    description
    kind
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
    sourceCode
    language
  }
`;

export const projectEvaluatorDetailsQueryNode = graphql`
  query projectEvaluatorDetailsQuery($id: ID!) {
    evaluator: node(id: $id) {
      __typename
      ...projectEvaluatorOptions_llmEvaluatorDetails
      ...projectEvaluatorOptions_codeEvaluatorDetails
    }
  }
`;

export type ProjectEvaluatorOption =
  projectEvaluatorOptionsQuery$data["evaluators"]["edges"][number]["evaluator"];

type ProjectEvaluatorDetailsNode = NonNullable<
  projectEvaluatorDetailsQuery["response"]["evaluator"]
>;

export type LlmProjectEvaluatorDetails =
  projectEvaluatorOptions_llmEvaluatorDetails$data;
export type CodeProjectEvaluatorDetails =
  projectEvaluatorOptions_codeEvaluatorDetails$data;
export type ProjectEvaluatorDetails =
  | LlmProjectEvaluatorDetails
  | CodeProjectEvaluatorDetails;

export function readProjectEvaluatorDetails(
  evaluator: ProjectEvaluatorDetailsNode | null
): ProjectEvaluatorDetails | null {
  if (evaluator?.__typename === "LLMEvaluator") {
    return readInlineData<projectEvaluatorOptions_llmEvaluatorDetails$key>(
      llmProjectEvaluatorDetailsFragment,
      evaluator
    );
  }
  if (evaluator?.__typename === "CodeEvaluator") {
    return readInlineData<projectEvaluatorOptions_codeEvaluatorDetails$key>(
      codeProjectEvaluatorDetailsFragment,
      evaluator
    );
  }
  return null;
}

export type BuildCopyLlmCreationModeResult =
  | { ok: true; mode: ProjectEvaluatorCreationMode }
  | { ok: false; reason: "unsupported-prompt-template" };

export const UNSUPPORTED_PROMPT_TEMPLATE_ERROR =
  "This evaluator uses an unsupported prompt template. Edit it to use a chat or string template, then try again.";

export function buildCopyLlmCreationMode(
  evaluator: LlmProjectEvaluatorDetails
): BuildCopyLlmCreationModeResult {
  const template = evaluator.promptVersion?.template;
  if (!template) {
    return { ok: false, reason: "unsupported-prompt-template" };
  }
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
  if (!defaultMessages) {
    return { ok: false, reason: "unsupported-prompt-template" };
  }
  return {
    ok: true,
    mode: {
      kind: "copy",
      initialState: {
        name: evaluator.name,
        description: evaluator.description ?? "",
        outputConfigs: convertProjectEvaluatorOutputConfigs(
          evaluator.outputConfigs
        ),
        defaultMessages,
        templateFormat: evaluator.promptVersion?.templateFormat ?? "MUSTACHE",
        includeExplanation: inferIncludeExplanationFromPrompt(
          evaluator.promptVersion?.tools
        ),
      },
    },
  };
}

export function buildAttachCodeCreationMode(
  evaluator: CodeProjectEvaluatorDetails
): ProjectEvaluatorCreationMode {
  const variables = extractCodeEvaluatorVariables({
    language: evaluator.language,
    sourceCode: evaluator.sourceCode,
  });
  const requiredVariables = extractRequiredCodeEvaluatorVariables({
    language: evaluator.language,
    sourceCode: evaluator.sourceCode,
  });
  return {
    kind: "code",
    evaluatorId: evaluator.id,
    name: evaluator.name,
    description: evaluator.description ?? "",
    outputConfigs: convertProjectEvaluatorOutputConfigs(
      evaluator.outputConfigs
    ),
    variables,
    requiredVariables,
  };
}

export function convertProjectEvaluatorOutputConfigs(
  configs: ReadonlyArray<unknown>
): AnnotationConfig[] {
  return configs.map((unknownConfig) => {
    if (!isStringKeyedObject(unknownConfig)) {
      throw new Error("Evaluator output config must be an object");
    }
    const config = unknownConfig;
    if (typeof config.name !== "string") {
      throw new Error("Evaluator output config must have a name");
    }
    const name = config.name;
    const optimizationDirection = getOptimizationDirection(
      config.optimizationDirection
    );
    if (!optimizationDirection) {
      throw new Error(
        `Evaluator output config "${name}" has an unsupported optimization direction`
      );
    }
    if (
      config.__typename === "CategoricalAnnotationConfig" &&
      Array.isArray(config.values)
    ) {
      return {
        name,
        optimizationDirection,
        values: config.values.map((unknownValue) => {
          if (
            !isStringKeyedObject(unknownValue) ||
            typeof unknownValue.label !== "string"
          ) {
            throw new Error(
              `Categorical output config "${name}" has an invalid choice`
            );
          }
          return {
            label: unknownValue.label,
            score:
              typeof unknownValue.score === "number"
                ? unknownValue.score
                : undefined,
          };
        }),
      };
    }
    if (config.__typename === "ContinuousAnnotationConfig") {
      return {
        name,
        optimizationDirection,
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      };
    }
    if (config.__typename === "FreeformAnnotationConfig") {
      return {
        name,
        optimizationDirection,
        threshold: getNullableNumber(config.threshold),
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      };
    }
    throw new Error(
      `Unsupported evaluator output config variant: ${String(config.__typename)}`
    );
  });
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
