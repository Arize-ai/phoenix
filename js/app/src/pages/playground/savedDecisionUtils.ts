import { toJsonTemplateText } from "@phoenix/components/decision/decisionTemplates";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  DecisionQuestionDraft,
  DecisionPromptDraft,
  DecisionStateDraft,
  PlaygroundInstance,
} from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  buildDecisionTaskDefinition,
  createChoiceOption,
  createDecisionQuestion,
  createDecisionStateDraft,
  createScaleLevel,
  type DecisionTaskDefinition,
} from "./decisionUtils";

/** The input `createDecision` and `createDecisionVersion` take for a version. */
export type DecisionVersionInput = DecisionTaskDefinition & {
  modelProvider: ModelProvider;
  modelName: string;
  customProviderId: string | null;
  description: string | null;
};

/**
 * The version input for an instance's decision.
 *
 * Throws when the draft is incomplete. `purpose` selects the error wording.
 */
export function toDecisionVersionInput({
  instance,
  templateFormat,
  description,
  purpose = "save",
}: {
  /** The instance's model and its decision prompt, read from the store. */
  instance: Pick<PlaygroundInstance, "model"> & {
    decisionPrompt: DecisionPromptDraft | null | undefined;
  };
  templateFormat: TemplateFormat;
  description?: string | null;
  purpose?: "save" | "test";
}): DecisionVersionInput {
  if (!instance.decisionPrompt) {
    throw new Error("The instance has no decision to save.");
  }
  const modelName = instance.model.modelName?.trim();
  if (!modelName) {
    throw new Error(
      purpose === "test"
        ? "Pick a decision model to test."
        : "Pick a decision model to save."
    );
  }
  return {
    ...buildDecisionTaskDefinition({
      draft: instance.decisionPrompt,
      templateFormat,
    }),
    modelProvider: instance.model.provider,
    modelName,
    customProviderId: instance.model.customProvider?.id ?? null,
    description: description?.trim() || null,
  };
}

/** A saved decision version as the playground reads it. */
export type SavedDecisionVersion = {
  templateFormat: TemplateFormat;
  state: { kind: "text"; text: string } | { kind: "json"; json: unknown };
  questions: ReadonlyArray<
    | {
        kind: "predicate";
        name: string;
        instructions: string;
        criteria: { true: string | null; false: string | null } | null;
      }
    | {
        kind: "choice";
        name: string;
        instructions: string;
        choices: ReadonlyArray<{ value: string; description: string | null }>;
      }
    | {
        kind: "scale";
        name: string;
        instructions: string;
        levels: ReadonlyArray<{ label: string; description: string | null }>;
      }
  >;
};

/** A decision question as GraphQL returns it on a version or task config. */
export type FetchedDecisionQuestion =
  | {
      readonly __typename: "DecisionPredicateQuestion";
      readonly name: string;
      readonly instructions: string;
      readonly criteria: {
        readonly true: string | null;
        readonly false: string | null;
      } | null;
    }
  | {
      readonly __typename: "DecisionChoiceQuestion";
      readonly name: string;
      readonly instructions: string;
      readonly choices: ReadonlyArray<{
        readonly value: string;
        readonly description: string | null;
      }>;
    }
  | {
      readonly __typename: "DecisionScaleQuestion";
      readonly name: string;
      readonly instructions: string;
      readonly levels: ReadonlyArray<{
        readonly label: string;
        readonly description: string | null;
      }>;
    }
  | { readonly __typename: "%other" };

/** GraphQL decision questions in the shape the draft conversion reads. */
export function toSavedDecisionQuestions(
  questions: ReadonlyArray<FetchedDecisionQuestion>
): SavedDecisionVersion["questions"][number][] {
  return questions.flatMap(
    (question): SavedDecisionVersion["questions"][number][] => {
      switch (question.__typename) {
        case "DecisionPredicateQuestion":
          return [
            {
              kind: "predicate",
              name: question.name,
              instructions: question.instructions,
              criteria: question.criteria ?? null,
            },
          ];
        case "DecisionChoiceQuestion":
          return [
            {
              kind: "choice",
              name: question.name,
              instructions: question.instructions,
              choices: question.choices,
            },
          ];
        case "DecisionScaleQuestion":
          return [
            {
              kind: "scale",
              name: question.name,
              instructions: question.instructions,
              levels: question.levels,
            },
          ];
        default:
          return [];
      }
    }
  );
}

const TEMPLATE_FORMAT_LABELS: Record<TemplateFormat, string> = {
  MUSTACHE: "Mustache",
  F_STRING: "F-String",
  NONE: "None",
};

/**
 * The editor draft for a saved version: its state template in the mode it
 * was saved in, and its questions.
 *
 * Throws when the page's template format is not the version's: the same
 * template reads differently in another format.
 */
export function savedDecisionVersionToDraft({
  version,
  templateFormat,
}: {
  version: SavedDecisionVersion;
  templateFormat: TemplateFormat;
}): DecisionPromptDraft {
  if (version.templateFormat !== templateFormat) {
    throw new Error(
      `This decision's templates are written in ${TEMPLATE_FORMAT_LABELS[version.templateFormat]}. Switch the template format to load it.`
    );
  }
  return {
    state: toDraftState({ state: version.state, templateFormat }),
    questions: version.questions.map(toDraftQuestion),
  };
}

function toDraftState({
  state,
  templateFormat,
}: {
  state: SavedDecisionVersion["state"];
  templateFormat: TemplateFormat;
}): DecisionStateDraft {
  switch (state.kind) {
    case "text":
      return createDecisionStateDraft({ mode: "text", text: state.text });
    case "json":
      return createDecisionStateDraft({
        mode: "json",
        json: toJsonTemplateText({ template: state.json, templateFormat }),
      });
    default:
      return assertUnreachable(state);
  }
}

export function toDraftQuestion(
  question: SavedDecisionVersion["questions"][number]
): DecisionQuestionDraft {
  switch (question.kind) {
    case "predicate":
      return createDecisionQuestion({
        type: "predicate",
        name: question.name,
        instructions: question.instructions,
        predicate: {
          trueDescription: question.criteria?.true ?? "",
          falseDescription: question.criteria?.false ?? "",
        },
      });
    case "choice":
      return createDecisionQuestion({
        type: "choice",
        name: question.name,
        instructions: question.instructions,
        choices: question.choices.map((choice) =>
          createChoiceOption({
            value: choice.value,
            description: choice.description ?? "",
          })
        ),
      });
    case "scale":
      return createDecisionQuestion({
        type: "scale",
        name: question.name,
        instructions: question.instructions,
        levels: question.levels.map((level) =>
          createScaleLevel({
            label: level.label,
            description: level.description ?? "",
          })
        ),
      });
    default:
      return assertUnreachable(question);
  }
}
