import { graphql } from "react-relay";
import z from "zod";

import type {
  EvaluatorCategory,
  projectEvaluatorTemplatesQuery$data,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

export const projectEvaluatorTemplatesQuery = graphql`
  query projectEvaluatorTemplatesQuery {
    evaluatorGalleryConfigs {
      name
      description
      choices
      optimizationDirection
      scope
      category
      details
      inputs {
        name
        description
      }
      messages {
        ...promptUtils_promptMessages
      }
    }
  }
`;

export type ProjectEvaluatorTemplate =
  projectEvaluatorTemplatesQuery$data["evaluatorGalleryConfigs"][number];

const EVALUATOR_CATEGORY_DETAILS: Record<
  EvaluatorCategory,
  { label: string; description: string }
> = {
  GROUNDING_AND_RETRIEVAL: {
    label: "Grounding & retrieval",
    description: "Check whether responses are supported by retrieved context.",
  },
  AGENTS: {
    label: "Agents",
    description: "Evaluate tool use, task completion, and agent behavior.",
  },
  RESPONSE_QUALITY: {
    label: "Response quality",
    description: "Assess correctness, relevance, and response quality.",
  },
  SAFETY_AND_SECURITY: {
    label: "Safety & security",
    description: "Detect harmful, insecure, or sensitive behavior.",
  },
  USER_EXPERIENCE: {
    label: "User experience",
    description: "Measure tone, clarity, and the user experience.",
  },
};

export const PROJECT_EVALUATOR_CATEGORIES = Object.entries(
  EVALUATOR_CATEGORY_DETAILS
).map(([value, details]) => ({
  value: value as EvaluatorCategory,
  ...details,
}));

export function getProjectEvaluatorTemplateCategoryLabel(
  category: EvaluatorCategory | null
): string {
  return category ? EVALUATOR_CATEGORY_DETAILS[category].label : "Other";
}

export function getProjectEvaluatorTemplateChoices(config: {
  choices: unknown;
}): { label: string; score: number }[] {
  const parsedChoices = z
    .record(z.string(), z.number())
    .safeParse(config.choices);
  const choices = parsedChoices.success ? parsedChoices.data : {};
  return Object.entries(choices).map(([label, score]) => ({ label, score }));
}

export function getProjectEvaluatorTemplateMessages(
  config: ProjectEvaluatorTemplate
) {
  return convertPromptVersionMessagesToPlaygroundInstanceMessages({
    promptMessagesRefs: config.messages,
  });
}

export function buildTemplateCreationMode(
  config: ProjectEvaluatorTemplate
): ProjectEvaluatorCreationMode {
  return {
    kind: "template",
    initialState: {
      targetType: config.scope ?? "SPAN",
      name: config.name,
      description: config.description ?? "",
      outputConfigs: [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          values: getProjectEvaluatorTemplateChoices(config),
        },
      ],
      defaultMessages: getProjectEvaluatorTemplateMessages(config),
      templateFormat: "MUSTACHE",
      includeExplanation: true,
    },
  };
}
