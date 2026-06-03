import { createStore } from "zustand";
import { devtools } from "zustand/middleware";

import type {
  AnnotationConfig,
  AnnotationConfigOptimizationDirection,
  AnnotationConfigType,
} from "@phoenix/pages/settings/types";

/**
 * A single category in a categorical annotation config.
 */
export type AnnotationConfigDraftValue = {
  label: string;
  score: number | null;
};

/**
 * A flat superset of every annotation-config type's fields. Holding all fields
 * at once (rather than a discriminated union) means switching `annotationType`
 * never discards data the user — or the agent — has already staged for another
 * type. The union is reconstructed on submit via {@link toAnnotationConfig}.
 */
export type AnnotationConfigDraftValues = {
  annotationType: AnnotationConfigType;
  name: string;
  description: string | null;
  optimizationDirection: AnnotationConfigOptimizationDirection;
  /** CATEGORICAL only. */
  values: AnnotationConfigDraftValue[];
  /** CONTINUOUS only. */
  lowerBound: number | null;
  /** CONTINUOUS only. */
  upperBound: number | null;
};

export type AnnotationConfigDraftStoreProps = {
  /** "create" makes a new config; "edit" updates an existing one (type is locked). */
  mode: "create" | "edit";
  /** GlobalID of the config being edited, or null when creating. */
  configId: string | null;
  draft: AnnotationConfigDraftValues;
  /** True once the draft has been mutated away from its initial state. */
  isDirty: boolean;
};

export type AnnotationConfigDraftStoreActions = {
  setName: (name: string) => void;
  setDescription: (description: string | null) => void;
  setAnnotationType: (annotationType: AnnotationConfigType) => void;
  setOptimizationDirection: (
    optimizationDirection: AnnotationConfigOptimizationDirection
  ) => void;
  setLowerBound: (lowerBound: number | null) => void;
  setUpperBound: (upperBound: number | null) => void;
  addValue: () => void;
  removeValue: (index: number) => void;
  updateValue: (
    index: number,
    patch: Partial<AnnotationConfigDraftValue>
  ) => void;
  replaceDraft: (draft: AnnotationConfigDraftValues) => void;
  reset: () => void;
};

export type AnnotationConfigDraftStore = AnnotationConfigDraftStoreProps &
  AnnotationConfigDraftStoreActions;

/**
 * Factory (not a shared constant) so every store instance — and every `reset` —
 * gets its own object and its own `values` array. Sharing one module-level
 * default would alias mutable state across draft stores.
 */
export const createDefaultAnnotationConfigDraft =
  (): AnnotationConfigDraftValues => ({
    annotationType: "CATEGORICAL",
    name: "",
    description: null,
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "", score: null },
      { label: "", score: null },
    ],
    lowerBound: null,
    upperBound: null,
  });

export type InitialAnnotationConfigDraftStoreProps = {
  mode: "create" | "edit";
  configId?: string | null;
  draft?: AnnotationConfigDraftValues;
};

export const createAnnotationConfigDraftStore = (
  init: InitialAnnotationConfigDraftStoreProps
) =>
  createStore<AnnotationConfigDraftStore>()(
    devtools(
      (set, get) => {
        const patchDraft = (
          patch: Partial<AnnotationConfigDraftValues>,
          action: string
        ) =>
          set(
            (state) => ({ draft: { ...state.draft, ...patch }, isDirty: true }),
            false,
            action
          );

        return {
          mode: init.mode,
          configId: init.configId ?? null,
          draft: init.draft ?? createDefaultAnnotationConfigDraft(),
          isDirty: false,

          setName: (name) => patchDraft({ name }, "setName"),
          setDescription: (description) =>
            patchDraft({ description }, "setDescription"),
          setOptimizationDirection: (optimizationDirection) =>
            patchDraft({ optimizationDirection }, "setOptimizationDirection"),
          setLowerBound: (lowerBound) =>
            patchDraft({ lowerBound }, "setLowerBound"),
          setUpperBound: (upperBound) =>
            patchDraft({ upperBound }, "setUpperBound"),

          
          setAnnotationType: (annotationType) => {
            if (get().mode === "edit") return; // The annotation type cannot change once a config exists
            patchDraft({ annotationType }, "setAnnotationType");
          },

          addValue: () =>
            set(
              (state) => ({
                draft: {
                  ...state.draft,
                  values: [...state.draft.values, { label: "", score: null }],
                },
                isDirty: true,
              }),
              false,
              "addValue"
            ),
          removeValue: (index) =>
            set(
              (state) => ({
                draft: {
                  ...state.draft,
                  values: state.draft.values.filter((_, i) => i !== index),
                },
                isDirty: true,
              }),
              false,
              "removeValue"
            ),
          updateValue: (index, patch) =>
            set(
              (state) => ({
                draft: {
                  ...state.draft,
                  values: state.draft.values.map((value, i) =>
                    i === index ? { ...value, ...patch } : value
                  ),
                },
                isDirty: true,
              }),
              false,
              "updateValue"
            ),

          replaceDraft: (draft) =>
            set({ draft, isDirty: true }, false, "replaceDraft"),
          reset: () =>
            set(
              {
                draft: init.draft ?? createDefaultAnnotationConfigDraft(),
                isDirty: false,
              },
              false,
              "reset"
            ),
        };
      },
      { name: "annotationConfigDraftStore" }
    )
  );

export type AnnotationConfigDraftStoreInstance = ReturnType<
  typeof createAnnotationConfigDraftStore
>;

/**
 * Build the initial store props from an existing config (edit) or nothing
 * (create). Lives next to the store so both the dialog and any agent host
 * seed the draft identically.
 */
export const initialDraftPropsFromConfig = (
  initialConfig?: Partial<AnnotationConfig>
): InitialAnnotationConfigDraftStoreProps => {
  if (!initialConfig) {
    return { mode: "create", configId: null };
  }
  // Read across the union without per-type narrowing; absent fields fall back
  // to defaults below.
  const anyConfig = initialConfig as {
    values?: readonly { label: string; score?: number | null }[];
    lowerBound?: number | null;
    upperBound?: number | null;
  };
  return {
    mode: "edit",
    configId: initialConfig.id ?? null,
    draft: {
      annotationType: initialConfig.annotationType ?? "CATEGORICAL",
      name: initialConfig.name ?? "",
      description: initialConfig.description ?? null,
      optimizationDirection: initialConfig.optimizationDirection ?? "MAXIMIZE",
      values:
        anyConfig.values?.map((value) => ({
          label: value.label,
          score: value.score ?? null,
        })) ?? createDefaultAnnotationConfigDraft().values,
      lowerBound: anyConfig.lowerBound ?? null,
      upperBound: anyConfig.upperBound ?? null,
    },
  };
};

/**
 * Discriminate the flat draft into the {@link AnnotationConfig} union expected
 * by the create/update mutations. Mirrors the per-type shaping the dialog used
 * to do inline on submit.
 */
export const toAnnotationConfig = (
  draft: AnnotationConfigDraftValues,
  id: string
): AnnotationConfig => {
  switch (draft.annotationType) {
    case "CATEGORICAL":
      return {
        id,
        annotationType: "CATEGORICAL",
        name: draft.name,
        description: draft.description,
        optimizationDirection: draft.optimizationDirection,
        values: draft.values,
      };
    case "CONTINUOUS":
      return {
        id,
        annotationType: "CONTINUOUS",
        name: draft.name,
        description: draft.description,
        optimizationDirection: draft.optimizationDirection,
        lowerBound: draft.lowerBound,
        upperBound: draft.upperBound,
      };
    case "FREEFORM":
      return {
        id,
        annotationType: "FREEFORM",
        name: draft.name,
        description: draft.description,
      };
  }
};

/**
 * Pure validation shared by the form's submit gate and (eventually) the agent
 * edit gate. Returns a map of field key → error message; an empty map is valid.
 * Field keys match the form controls: "name", "lowerBound", "upperBound", and
 * `values.${index}.label`.
 */
export const validateAnnotationConfigDraft = (
  draft: AnnotationConfigDraftValues
): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) {
    errors.name = "Name is required";
  } else if (draft.name === "note") {
    errors.name = "'note' is a reserved name";
  }
  if (draft.annotationType === "CONTINUOUS") {
    if (draft.lowerBound == null || isNaN(draft.lowerBound)) {
      errors.lowerBound = "Min is required";
    }
    if (draft.upperBound == null || isNaN(draft.upperBound)) {
      errors.upperBound = "Max is required";
    } else if (draft.lowerBound != null && draft.upperBound <= draft.lowerBound) {
      errors.upperBound = "Max must be greater than min";
    }
  }
  if (draft.annotationType === "CATEGORICAL") {
    if (draft.values.length === 0) {
      errors.values = "At least one category is required";
    }
    draft.values.forEach((value, index) => {
      if (!value.label.trim()) {
        errors[`values.${index}.label`] = "Category label is required";
      }
    });
  }
  return errors;
};
