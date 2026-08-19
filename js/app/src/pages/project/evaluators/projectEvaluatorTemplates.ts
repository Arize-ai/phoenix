import { graphql } from "react-relay";
import z from "zod";

import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { projectEvaluatorTemplatesQuery$data } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

export const projectEvaluatorTemplatesQuery = graphql`
  query projectEvaluatorTemplatesQuery {
    classificationEvaluatorConfigs {
      name
      description
      choices
      optimizationDirection
      messages {
        ...promptUtils_promptMessages
      }
    }
  }
`;

export type ProjectEvaluatorTemplate =
  projectEvaluatorTemplatesQuery$data["classificationEvaluatorConfigs"][number];

export type EvaluatorTemplateMetadata = {
  useCase: string;
  scope: "span" | "trace" | "session";
  recommended: boolean;
  kind: "LLM" | "CODE";
  longDescription?: string;
};

const DEFAULT_TEMPLATE_METADATA = {
  useCase: "Other",
  scope: "span",
  recommended: false,
  kind: "LLM",
} as const satisfies EvaluatorTemplateMetadata;

const PROJECT_EVALUATOR_TEMPLATE_METADATA: Partial<
  Record<string, EvaluatorTemplateMetadata>
> = {
  hallucination: {
    useCase: "Answer quality",
    scope: "span",
    recommended: true,
    kind: "LLM",
  },
  correctness: {
    useCase: "Answer quality",
    scope: "span",
    recommended: true,
    kind: "LLM",
  },
  conciseness: {
    useCase: "Answer quality",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  document_relevance: {
    useCase: "Retrieval & context",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  faithfulness: {
    useCase: "Retrieval & context",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  tool_invocation: {
    useCase: "Agents & tool use",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  tool_selection: {
    useCase: "Agents & tool use",
    scope: "span",
    recommended: true,
    kind: "LLM",
  },
  tool_response_handling: {
    useCase: "Agents & tool use",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  refusal: {
    useCase: "Safety",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
  toxicity: {
    useCase: "Safety",
    scope: "span",
    recommended: true,
    kind: "LLM",
  },
  user_friction: {
    useCase: "User experience",
    scope: "span",
    recommended: false,
    kind: "LLM",
  },
};

export function getProjectEvaluatorTemplateMetadata(
  templateName: string
): EvaluatorTemplateMetadata {
  return (
    PROJECT_EVALUATOR_TEMPLATE_METADATA[templateName] ??
    DEFAULT_TEMPLATE_METADATA
  );
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
      includeExplanation: inferIncludeExplanationFromPrompt(undefined),
    },
  };
}
