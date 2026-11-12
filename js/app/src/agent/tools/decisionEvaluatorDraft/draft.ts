import { z } from "zod";

import type { DecisionScoringPolicyValue } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  createChoiceOption,
  createDecisionQuestion,
  createScaleLevel,
  type DecisionDraftErrors,
  validateDecisionDraft,
} from "@phoenix/pages/playground/decisionUtils";
import type {
  DecisionPromptDraft,
  DecisionQuestionDraft,
} from "@phoenix/store/playground";
import type { EvaluatorInputMapping } from "@phoenix/types";

import {
  decisionModelTargetSchema,
  type DecisionModelOption,
  findDecisionModelOption,
} from "./models";

const optimizationDirectionSchema = z.enum(["MAXIMIZE", "MINIMIZE", "NONE"]);

const questionSchema = z
  .strictObject({
    name: z
      .string()
      .describe(
        "The question's name; it names the annotation it produces and must be unique."
      ),
    type: z
      .enum(["predicate", "choice", "scale"])
      .describe(
        "predicate: a yes/no question answered with a probability; choice: " +
          "pick one of `choices`; scale: pick one of the ordered `levels`."
      ),
    instructions: z.string().describe("The question the model answers."),
    choices: z
      .array(
        z.strictObject({
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .optional()
      .describe("choice questions: at least two options."),
    levels: z
      .array(
        z.strictObject({
          label: z.string(),
          description: z.string().optional(),
        })
      )
      .optional()
      .describe("scale questions: at least two levels, lowest first."),
    trueDescription: z
      .string()
      .optional()
      .describe("predicate questions: what a yes means."),
    falseDescription: z
      .string()
      .optional()
      .describe("predicate questions: what a no means."),
  })
  .describe("One decision question.");

const scoringPolicySchema = z
  .strictObject({
    questions: z.array(
      z.union([
        z.strictObject({
          predicate: z.strictObject({
            name: z.string(),
            threshold: z.number().min(0).max(1),
            optimizationDirection: optimizationDirectionSchema,
          }),
        }),
        z.strictObject({
          choice: z.strictObject({
            name: z.string(),
            scores: z.array(
              z.strictObject({ choice: z.string(), score: z.number() })
            ),
            optimizationDirection: optimizationDirectionSchema,
          }),
        }),
        z.strictObject({
          scale: z.strictObject({
            name: z.string(),
            includeLabel: z.boolean(),
            optimizationDirection: optimizationDirectionSchema,
          }),
        }),
      ])
    ),
  })
  .describe(
    "How each question's answer becomes a label and score, one entry per " +
      "question by name. Omitted questions keep their defaults."
  );

export const editDecisionEvaluatorDraftOperationSchema = z.discriminatedUnion(
  "type",
  [
    z.strictObject({ type: z.literal("set_name"), name: z.string().min(1) }),
    z.strictObject({
      type: z.literal("set_state"),
      mode: z
        .enum(["text", "json"])
        .optional()
        .describe(
          "Which template the state uses; defaults to the current mode."
        ),
      template: z
        .string()
        .describe(
          "The state template: the evidence the model reads, with variables " +
            "in the draft's template format (Mustache: `{{input}}`). In json " +
            "mode, a JSON value whose string leaves are templates."
        ),
    }),
    z.strictObject({
      type: z.literal("set_questions"),
      questions: z
        .array(questionSchema)
        .min(1)
        .describe("Whole-list replacement of the questions, in order."),
    }),
    z.strictObject({
      type: z.literal("set_scoring_policy"),
      scoringPolicy: scoringPolicySchema,
    }),
    z.strictObject({
      type: z.literal("set_model"),
      target: decisionModelTargetSchema,
    }),
    z.strictObject({
      type: z.literal("set_input_mapping"),
      inputMapping: z.strictObject({
        pathMapping: z.record(z.string(), z.string()).optional(),
        literalMapping: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
      }),
    }),
  ]
);

export const editDecisionEvaluatorDraftInputSchema = z.strictObject({
  operations: z
    .array(editDecisionEvaluatorDraftOperationSchema)
    .min(1)
    .describe("Ordered edit operations to apply to the draft."),
});

export type EditDecisionEvaluatorDraftOperation = z.output<
  typeof editDecisionEvaluatorDraftOperationSchema
>;

export type DecisionEvaluatorQuestionSnapshot = {
  name: string;
  type: DecisionQuestionDraft["type"];
  instructions: string;
  choices: { value: string; description: string }[];
  levels: { label: string; description: string }[];
  trueDescription: string;
  falseDescription: string;
};

/** What `evaluators.decision.read` returns. */
export type DecisionEvaluatorDraftSnapshot = {
  mode: "create" | "edit";
  evaluatorNodeId: string | null;
  name: string;
  model: {
    provider: string;
    modelName: string | null;
    /** Set when the model runs on a custom provider. */
    customProviderId: string | null;
    customProviderName: string | null;
  };
  templateFormat: TemplateFormat;
  state: { mode: "text" | "json"; template: string };
  questions: DecisionEvaluatorQuestionSnapshot[];
  scoringPolicy: DecisionScoringPolicyValue;
  /** The variables the state and questions read; each is mapped from the record. */
  variables: string[];
  inputMapping: EvaluatorInputMapping;
  /** What stops the draft from being tested or saved, if anything. */
  definitionErrors: string[];
};

export function toQuestionSnapshot(
  question: DecisionQuestionDraft
): DecisionEvaluatorQuestionSnapshot {
  return {
    name: question.name,
    type: question.type,
    instructions: question.instructions,
    choices: question.choices.map(({ value, description }) => ({
      value,
      description,
    })),
    levels: question.levels.map(({ label, description }) => ({
      label,
      description,
    })),
    trueDescription: question.predicate.trueDescription,
    falseDescription: question.predicate.falseDescription,
  };
}

/**
 * The draft questions an edit asks for. A question keeps its id when its
 * name is unchanged, so the editor keeps what it shows for it.
 */
export function toQuestionDrafts({
  questions,
  previous,
}: {
  questions: z.output<typeof questionSchema>[];
  previous: readonly DecisionQuestionDraft[];
}): DecisionQuestionDraft[] {
  return questions.map((question) => {
    const draft = createDecisionQuestion({
      type: question.type,
      name: question.name,
      instructions: question.instructions,
      choices: (question.choices ?? []).map((choice) =>
        createChoiceOption({
          value: choice.value,
          description: choice.description ?? "",
        })
      ),
      levels: (question.levels ?? []).map((level) =>
        createScaleLevel({
          label: level.label,
          description: level.description ?? "",
        })
      ),
      predicate: {
        trueDescription: question.trueDescription ?? "",
        falseDescription: question.falseDescription ?? "",
      },
    });
    const kept = previous.find(({ name }) => name === question.name);
    return kept ? { ...draft, id: kept.id } : draft;
  });
}

/** The draft's problems, as sentences an agent can act on. */
export function formatDecisionDraftErrors({
  errors,
  draft,
}: {
  errors: DecisionDraftErrors;
  draft: DecisionPromptDraft;
}): string[] {
  const messages: string[] = [];
  if (errors.state) messages.push(`state: ${errors.state}`);
  if (errors.questions) messages.push(`questions: ${errors.questions}`);
  draft.questions.forEach((question, index) => {
    const questionErrors = errors.byQuestionId[question.id];
    if (!questionErrors) return;
    const label = question.name.trim() || `question ${index + 1}`;
    for (const [field, value] of Object.entries(questionErrors)) {
      if (typeof value === "string") {
        messages.push(`${label}.${field}: ${value}`);
      } else if (value) {
        const values = Object.values(value).filter(Boolean);
        if (values.length) {
          messages.push(
            `${label}.${field}: ${[...new Set(values)].join("; ")}`
          );
        }
      }
    }
  });
  return messages;
}

/** The draft as it stands after the operations, or why it cannot be. */
export type DecisionDraftEditResult =
  | {
      ok: true;
      name: string;
      prompt: DecisionPromptDraft;
      scoringPolicy: DecisionScoringPolicyValue | null;
      inputMapping: EvaluatorInputMapping;
      /** The model a set_model chose; null when the model is unchanged. */
      model: DecisionModelOption | null;
    }
  | { ok: false; error: string };

/**
 * Applies edit operations to the parts of a decision draft PXI may change.
 * A policy set here is passed back unnormalized: the form fits it to the
 * questions as it does a policy the user edits.
 */
export function applyDecisionDraftOperations({
  name,
  prompt,
  scoringPolicy,
  inputMapping,
  templateFormat,
  operations,
  availableModels,
}: {
  name: string;
  prompt: DecisionPromptDraft;
  scoringPolicy: DecisionScoringPolicyValue | null;
  inputMapping: EvaluatorInputMapping;
  templateFormat: TemplateFormat;
  operations: readonly EditDecisionEvaluatorDraftOperation[];
  /** The decision models the form offers; needed only for set_model. */
  availableModels?: readonly DecisionModelOption[];
}): DecisionDraftEditResult {
  let next: {
    name: string;
    prompt: DecisionPromptDraft;
    scoringPolicy: DecisionScoringPolicyValue | null;
    inputMapping: EvaluatorInputMapping;
    model: DecisionModelOption | null;
  } = { name, prompt, scoringPolicy, inputMapping, model: null };
  for (const operation of operations) {
    switch (operation.type) {
      case "set_name":
        next = { ...next, name: operation.name.trim() };
        break;
      case "set_state": {
        const mode = operation.mode ?? next.prompt.state.mode;
        next = {
          ...next,
          prompt: {
            ...next.prompt,
            state: {
              ...next.prompt.state,
              mode,
              ...(mode === "json"
                ? { json: operation.template }
                : { text: operation.template }),
            },
          },
        };
        break;
      }
      case "set_questions":
        next = {
          ...next,
          prompt: {
            ...next.prompt,
            questions: toQuestionDrafts({
              questions: operation.questions,
              previous: next.prompt.questions,
            }),
          },
        };
        break;
      case "set_scoring_policy":
        next = { ...next, scoringPolicy: operation.scoringPolicy };
        break;
      case "set_model": {
        const found = findDecisionModelOption({
          target: operation.target,
          options: availableModels ?? [],
        });
        if (!found.ok) {
          return found;
        }
        next = { ...next, model: found.option };
        break;
      }
      case "set_input_mapping":
        next = {
          ...next,
          inputMapping: {
            pathMapping:
              operation.inputMapping.pathMapping ??
              next.inputMapping.pathMapping,
            literalMapping:
              operation.inputMapping.literalMapping ??
              next.inputMapping.literalMapping,
          },
        };
        break;
    }
  }
  const errors = formatDecisionDraftErrors({
    errors: validateDecisionDraft({ draft: next.prompt, templateFormat }),
    draft: next.prompt,
  });
  if (errors.length > 0) {
    return {
      ok: false,
      error: `The edit leaves the decision invalid, so nothing was changed: ${errors.join("; ")}.`,
    };
  }
  const policyNames = next.scoringPolicy?.questions.map(
    (entry) => Object.values(entry)[0].name
  );
  const unknown = policyNames?.filter(
    (policyName) =>
      !next.prompt.questions.some((question) => question.name === policyName)
  );
  if (unknown && unknown.length > 0) {
    return {
      ok: false,
      error: `The scoring policy names questions the draft does not have: ${unknown.join(", ")}.`,
    };
  }
  return { ok: true, ...next };
}
