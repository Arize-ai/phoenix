import { graphql } from "react-relay";
import z from "zod";

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

export type EvaluatorTemplateCategory =
  | "GROUNDING_AND_RETRIEVAL"
  | "AGENTS"
  | "RESPONSE_QUALITY"
  | "SAFETY_AND_SECURITY"
  | "USER_EXPERIENCE";

export type EvaluatorTemplateMetadata = {
  scope: "SPAN" | "TRACE" | "SESSION" | null;
  recommended: boolean;
  category: EvaluatorTemplateCategory | null;
  kind: "LLM" | "CODE";
  details: string | null;
  inputs: ReadonlyArray<{
    name: string;
    description: string;
    format: string | null;
  }> | null;
};

const DEFAULT_TEMPLATE_METADATA = {
  scope: null,
  recommended: false,
  category: null,
  kind: "LLM",
  details: null,
  inputs: null,
} as const satisfies EvaluatorTemplateMetadata;

// TODO: Remove this mock metadata once https://github.com/Arize-ai/phoenix/pull/15495
// merges and these fields are available from evaluatorGalleryConfigs.
const PROJECT_EVALUATOR_TEMPLATE_METADATA: Partial<
  Record<string, EvaluatorTemplateMetadata>
> = {
  conciseness: {
    scope: "SPAN",
    recommended: false,
    category: "RESPONSE_QUALITY",
    kind: "LLM",
    details:
      "Assesses whether an LLM's response uses the minimum number of words necessary to fully answer the question. It detects unnecessary pleasantries, hedging language, meta-commentary, redundant restatements, and unsolicited explanations.",
    inputs: [
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation.",
        format: null,
      },
      {
        name: "output",
        description: "The LLM's output response to be evaluated.",
        format: null,
      },
    ],
  },
  correctness: {
    scope: "SPAN",
    recommended: false,
    category: "RESPONSE_QUALITY",
    kind: "LLM",
    details:
      "A broad, general purpose metric to determine whether an LLM's response is factually accurate, complete, and logically consistent. It evaluates answer quality without requiring external context or reference responses.",
    inputs: [
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation.",
        format: null,
      },
      {
        name: "output",
        description: "The LLM's output response to be evaluated.",
        format: null,
      },
    ],
  },
  document_relevance: {
    scope: "SPAN",
    recommended: false,
    category: "GROUNDING_AND_RETRIEVAL",
    kind: "LLM",
    details:
      "Determines whether a retrieved document contains information relevant to answering the input query. This is essential for evaluating RAG systems, where document quality directly impacts response quality.",
    inputs: [
      {
        name: "document_text",
        description: "The content of the retrieved document or context.",
        format: null,
      },
      {
        name: "input",
        description: "The input query or conversational context.",
        format: null,
      },
    ],
  },
  faithfulness: {
    scope: "SPAN",
    recommended: false,
    category: "GROUNDING_AND_RETRIEVAL",
    kind: "LLM",
    details:
      "Determines whether an LLM's response is grounded in and faithful to the provided context. It detects information that is unsupported by or contradicts the reference context and is intended for grounded responses such as RAG outputs.",
    inputs: [
      {
        name: "context",
        description: "The content of the retrieved documents or context.",
        format: null,
      },
      {
        name: "input",
        description: "The input query or conversational context.",
        format: null,
      },
      {
        name: "output",
        description: "The LLM's output response to be evaluated.",
        format: null,
      },
    ],
  },
  hallucination: {
    scope: "SPAN",
    recommended: true,
    category: "GROUNDING_AND_RETRIEVAL",
    kind: "LLM",
    details:
      "Determines whether an assistant's response contains claims unsupported by or contradictory to the conversation it had access to. Unlike Faithfulness, which grounds a response in one retrieved context block, Hallucination uses the broader conversation, including earlier turns, tool calls, tool results, and retrieved context.",
    inputs: [
      {
        name: "input",
        description:
          "The entire conversational context, including all messages, tool calls, and tool results.",
        format: null,
      },
      {
        name: "output",
        description:
          "The LLM's output response (messages and tool calls) to be evaluated.",
        format: null,
      },
    ],
  },
  refusal: {
    scope: "SPAN",
    recommended: false,
    category: "USER_EXPERIENCE",
    kind: "LLM",
    details:
      "Detects when an LLM refuses, declines, or avoids answering a user query. It captures explicit refusals, scope disclaimers, lack-of-information responses, safety refusals, redirections, and apologetic non-answers. It does not judge whether the refusal was the appropriate response.",
    inputs: [
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation.",
        format: null,
      },
      {
        name: "output",
        description: "The LLM's output response to be evaluated.",
        format: null,
      },
    ],
  },
  tool_invocation: {
    scope: "SPAN",
    recommended: false,
    category: "AGENTS",
    kind: "LLM",
    details:
      "Determines whether an LLM invoked a tool correctly with proper arguments, formatting, and safe content. It focuses on how the tool was called rather than whether the right tool was selected. It works even if no tools were called.",
    inputs: [
      {
        name: "available_tools",
        description:
          "The list of available tools, including names and descriptions. A simple human-readable list is better than including the full tool schemas.",
        format: null,
      },
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation.",
        format: null,
      },
      {
        name: "tool_selection",
        description:
          "The LLM's output response (including messages and tool calls) to be evaluated.",
        format: null,
      },
    ],
  },
  tool_selection: {
    scope: "SPAN",
    recommended: true,
    category: "AGENTS",
    kind: "LLM",
    details:
      "Determines whether an LLM selected the most appropriate tool or tools for a given task. It focuses on what tool was chosen rather than whether the invocation arguments were correct.",
    inputs: [
      {
        name: "available_tools",
        description:
          "The list of available tools, including names and descriptions. A simple human-readable list is better than including the full tool schemas as JSON.",
        format: null,
      },
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation. Intermediate tool calls/results are not required.",
        format: null,
      },
      {
        name: "tool_selection",
        description: "The tool or tools called by the LLM.",
        format: null,
      },
    ],
  },
  tool_response_handling: {
    scope: "TRACE",
    recommended: false,
    category: "AGENTS",
    kind: "LLM",
    details:
      "Determines whether an AI agent correctly processed a tool's result to produce an appropriate output. It focuses on what happens after a tool call by checking that the agent used the result accurately, handled errors, and disclosed information safely.",
    inputs: [
      {
        name: "input",
        description:
          "The conversational context, whether that is a single input query or a full turn-by-turn conversation. Intermediate tool calls/results are not required.",
        format: null,
      },
      {
        name: "tool_call",
        description:
          "Details of the tool or tools that were called, including name and parameters.",
        format: null,
      },
      {
        name: "tool_result",
        description: "The complete tool results, including any errors.",
        format: null,
      },
      {
        name: "output",
        description:
          "The LLM's output messages after the tool call (including messages and tool calls).",
        format: null,
      },
    ],
  },
  toxicity: {
    scope: "SPAN",
    recommended: false,
    category: "SAFETY_AND_SECURITY",
    kind: "LLM",
    details:
      "Classifies a single piece of text as toxic or non-toxic. Text is toxic when it makes hateful or discriminatory statements about a person or group, demeans or insults someone, uses abusive language directed at a person, or threatens or incites harm.",
    inputs: [
      {
        name: "text",
        description:
          "The text to be evaluated for toxicty. This could be either an input (user message) or an output (LLM message).",
        format: null,
      },
    ],
  },
  user_friction: {
    scope: "TRACE",
    recommended: false,
    category: "USER_EXPERIENCE",
    kind: "LLM",
    details:
      "Classifies whether the latest user message expresses friction with an assistant's preceding behavior. It detects corrections, retries after an unsuccessful response, frustration, and challenges to unrequested or unexplained actions.",
    inputs: [
      {
        name: "conversation",
        description:
          "The complete conversational context, including user/assistant messages. Intermediate tool calls/results are optional but may help, especially those from the most recent turn.",
        format: null,
      },
      {
        name: "user_message",
        description: "The latest user message to be evaluated.",
        format: null,
      },
    ],
  },
};

const EVALUATOR_CATEGORY_LABELS: Record<EvaluatorTemplateCategory, string> = {
  GROUNDING_AND_RETRIEVAL: "Grounding & retrieval",
  AGENTS: "Agents",
  RESPONSE_QUALITY: "Response quality",
  SAFETY_AND_SECURITY: "Safety & security",
  USER_EXPERIENCE: "User experience",
};

export function getProjectEvaluatorTemplateMetadata(
  templateName: string
): EvaluatorTemplateMetadata {
  return (
    PROJECT_EVALUATOR_TEMPLATE_METADATA[templateName] ??
    DEFAULT_TEMPLATE_METADATA
  );
}

export function getProjectEvaluatorTemplateCategoryLabel(
  category: EvaluatorTemplateCategory | null
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
