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
      recommended
      category
      details
      messages {
        ...promptUtils_promptMessages
      }
    }
  }
`;

export type ProjectEvaluatorTemplate =
  projectEvaluatorTemplatesQuery$data["evaluatorGalleryConfigs"][number];

const EVALUATOR_CATEGORY_LABELS: Record<EvaluatorCategory, string> = {
  GROUNDING_AND_RETRIEVAL: "Grounding & retrieval",
  AGENTS: "Agents",
  RESPONSE_QUALITY: "Response quality",
  SAFETY_AND_SECURITY: "Safety & security",
  USER_EXPERIENCE: "User experience",
};

export function getProjectEvaluatorTemplateCategoryLabel(
  category: EvaluatorCategory | null
): string {
  return category ? EVALUATOR_CATEGORY_LABELS[category] : "Other";
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
      defaultMessages: convertPromptVersionMessagesToPlaygroundInstanceMessages(
        {
          promptMessagesRefs: config.messages,
        }
      ),
      templateFormat: "MUSTACHE",
      includeExplanation: true,
    },
  };
}
