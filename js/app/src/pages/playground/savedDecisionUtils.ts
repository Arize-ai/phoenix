import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  DecisionInputDeclaration,
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
  parseStateInputNames,
  stateTemplateVariables,
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
  instance: Pick<PlaygroundInstance, "model" | "decisionRequest">;
  templateFormat: TemplateFormat;
  description?: string | null;
  purpose?: "dataset" | "save" | "test";
}): DecisionVersionInput {
  if (!instance.decisionRequest) {
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
      draft: instance.decisionRequest,
      templateFormat,
      purpose,
    }),
    modelProvider: instance.model.provider,
    modelName,
    customProviderId: instance.model.customProvider?.id ?? null,
    description: description?.trim() || null,
  };
}

/** A saved decision version as the playground reads it. */
export type SavedDecisionVersion = {
  inputs?: ReadonlyArray<DecisionInputDeclaration>;
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
 * Throws when a text state is written in the other template format.
 */
export function savedDecisionVersionToDraft({
  version,
  templateFormat,
}: {
  version: SavedDecisionVersion;
  templateFormat: TemplateFormat;
}): DecisionRequestDraft {
  const draftState = toDraftState({ state: version.state, templateFormat });
  const impliedNames = new Set(
    draftState.stateEditorMode === "input"
      ? [draftState.state.trim()]
      : draftState.stateEditorMode === "inputs"
        ? parseStateInputNames(draftState.state)
        : stateTemplateVariables(draftState.state, templateFormat)
  );
  const hasExplicitInputs = version.inputs?.some(
    (input) =>
      input.description != null ||
      input.jsonSchema != null ||
      !impliedNames.has(input.name)
  );
  const additionalInputNames = version.inputs
    ?.filter((input) => !impliedNames.has(input.name))
    .map((input) => input.name);
  return {
    ...draftState,
    ...(hasExplicitInputs && version.inputs ? { inputs: version.inputs } : {}),
    ...(additionalInputNames?.length ? { additionalInputNames } : {}),
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
      return { state: state.input, stateEditorMode: "input" };
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
