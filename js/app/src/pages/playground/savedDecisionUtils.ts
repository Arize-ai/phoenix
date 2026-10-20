import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  DecisionQuestionDraft,
  DecisionRequestDraft,
  PlaygroundInstance,
} from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  buildDecisionTaskDefinition,
  createChoiceOption,
  createDecisionQuestion,
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
 * A saved version of an instance's decision: its definition, written as a
 * function of named inputs, and the model that answers.
 *
 * Throws when the draft can't be saved; see
 * {@link getDecisionDatasetProblem} with `purpose: "save"`.
 */
export function toDecisionVersionInput({
  instance,
  templateFormat,
  description,
}: {
  instance: Pick<PlaygroundInstance, "model" | "decisionRequest">;
  templateFormat: TemplateFormat;
  description?: string | null;
}): DecisionVersionInput {
  if (!instance.decisionRequest) {
    throw new Error("The instance has no decision to save.");
  }
  const modelName = instance.model.modelName?.trim();
  if (!modelName) {
    throw new Error("Pick a decision model to save.");
  }
  return {
    ...buildDecisionTaskDefinition({
      draft: instance.decisionRequest,
      templateFormat,
      purpose: "save",
    }),
    modelProvider: instance.model.provider,
    modelName,
    customProviderId: instance.model.customProvider?.id ?? null,
    description: description?.trim() || null,
  };
}

/** A saved decision version as the playground reads it. */
export type SavedDecisionVersion = {
  state:
    | { kind: "input"; input: string }
    | {
        kind: "text";
        template: string;
        templateFormat: "MUSTACHE" | "F_STRING";
      }
    | { kind: "object"; inputs: readonly string[] };
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

const TEMPLATE_FORMAT_NAMES: Record<"MUSTACHE" | "F_STRING", TemplateFormat> = {
  MUSTACHE: TemplateFormats.Mustache,
  F_STRING: TemplateFormats.FString,
};

/**
 * The editor draft for a saved version, written in the page's template
 * format.
 *
 * Throws when the page's format can't express the version's state: a text
 * state written in the other template format, or an input state on a page
 * without template variables.
 */
export function savedDecisionVersionToDraft({
  version,
  templateFormat,
}: {
  version: SavedDecisionVersion;
  templateFormat: TemplateFormat;
}): DecisionRequestDraft {
  return {
    ...toDraftState({ state: version.state, templateFormat }),
    questions: version.questions.map(toDraftQuestion),
  };
}

function toDraftState({
  state,
  templateFormat,
}: {
  state: SavedDecisionVersion["state"];
  templateFormat: TemplateFormat;
}): Pick<DecisionRequestDraft, "state" | "stateEditorMode"> {
  switch (state.kind) {
    case "input":
      if (templateFormat === TemplateFormats.FString)
        return { state: `{${state.input}}`, stateEditorMode: "text" };
      if (templateFormat === TemplateFormats.Mustache)
        return { state: `{{${state.input}}}`, stateEditorMode: "text" };
      throw new Error(
        "This decision's state is an input. Switch the template format to Mustache or F-String to load it."
      );
    case "text": {
      const format = TEMPLATE_FORMAT_NAMES[state.templateFormat];
      if (format !== templateFormat) {
        throw new Error(
          `This decision's state is written in ${format === TemplateFormats.Mustache ? "Mustache" : "F-String"}. Switch the template format to load it.`
        );
      }
      return { state: state.template, stateEditorMode: "text" };
    }
    case "object":
      return { state: state.inputs.join(", "), stateEditorMode: "inputs" };
    default:
      return assertUnreachable(state);
  }
}

function toDraftQuestion(
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
