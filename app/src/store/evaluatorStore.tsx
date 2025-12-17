import merge from "lodash/merge";
import invariant from "tiny-invariant";
import { createStore } from "zustand";
import { devtools } from "zustand/middleware";

import type {
  ClassificationChoice,
  ClassificationEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
  EvaluatorKind,
  EvaluatorOptimizationDirection,
  EvaluatorPreMappedInput,
} from "@phoenix/types";
import type { DeepPartial } from "@phoenix/typeUtils";

export type EvaluatorStoreProps = {
  datasetEvaluator?: {
    id: string;
  };
  evaluator: {
    id?: string;
    name: string;
    displayName: string;
    inputMapping: EvaluatorInputMapping;
    kind: EvaluatorKind;
    description: string;
    isBuiltin: boolean;
    includeExplanation: boolean;
  };
  outputConfig?: ClassificationEvaluatorAnnotationConfig;
  dataset?: {
    id: string;
    readonly: boolean;
    selectedExampleId: string | null;
    selectedSplitIds: string[];
  };
  preMappedInput: EvaluatorPreMappedInput;
  showPromptPreview: boolean;
};

export type EvaluatorStoreActions = {
  /** Sets the internal name (slug) of the evaluator. */
  setEvaluatorName: (name: string) => void;
  /** Sets the user-facing display name of the evaluator. */
  setEvaluatorDisplayName: (displayName: string) => void;
  /** Sets the description of the evaluator. */
  setEvaluatorDescription: (description: string) => void;
  /** Sets whether the evaluator should include an explanation in its output. */
  setIncludeExplanation: (includeExplanation: boolean) => void;
  /** Sets the name of the output configuration (annotation name). */
  setOutputConfigName: (name: string) => void;
  /** Sets the optimization direction (MAXIMIZE or MINIMIZE) for the output config. */
  setOutputConfigOptimizationDirection: (
    optimizationDirection: EvaluatorOptimizationDirection
  ) => void;
  /** Sets the classification choices for the output configuration. */
  setOutputConfigValues: (values: ClassificationChoice[]) => void;
  /** Sets a single path mapping entry by key. */
  setInputMappingPath: (path: string, value: string) => void;
  /** Sets a single literal mapping entry by key. */
  setInputMappingLiteral: (literal: string, value: string) => void;
  /** Replaces the entire path mapping object. */
  setPathMapping: (pathMapping: EvaluatorInputMapping["pathMapping"]) => void;
  /** Replaces the entire literal mapping object. */
  setLiteralMapping: (
    literalMapping: EvaluatorInputMapping["literalMapping"]
  ) => void;
  /** Sets the dataset configuration for the evaluator. */
  setDataset: (dataset: EvaluatorStoreProps["dataset"]) => void;
  /** Sets the dataset ID, or clears the dataset if null. */
  setDatasetId: (datasetId: string | null) => void;
  /** Sets the pre-mapped input data (input, output, expected). */
  setPreMappedInput: (preMappedInput: EvaluatorPreMappedInput) => void;
  /** Sets the currently selected example ID within the dataset. */
  setSelectedExampleId: (selectedExampleId?: string | null) => void;
  /** Sets the selected split IDs for filtering dataset examples. */
  setSelectedSplitIds: (selectedSplitIds: string[]) => void;
  /** Sets whether to show the prompt preview panel. */
  setShowPromptPreview: (showPromptPreview: boolean) => void;
};

export type EvaluatorStore = EvaluatorStoreProps & EvaluatorStoreActions;

/**
 * Default value for the pre-mapped input.
 */
export const EVALUATOR_PRE_MAPPED_INPUT_DEFAULT: EvaluatorPreMappedInput = {
  input: {},
  output: {},
  expected: {},
};

/**
 * Default value for the pre-mapped input as a string.
 */
export const EVALUATOR_PRE_MAPPED_INPUT_DEFAULT_STRING = JSON.stringify(
  EVALUATOR_PRE_MAPPED_INPUT_DEFAULT,
  null,
  2
);

/**
 * Common default values for all evaluator kinds.
 */
export const DEFAULT_STORE_VALUES = {
  evaluator: {
    name: "",
    displayName: "",
    description: "",
    inputMapping: {
      literalMapping: {},
      pathMapping: {},
    },
    includeExplanation: true,
  },
  preMappedInput: EVALUATOR_PRE_MAPPED_INPUT_DEFAULT,
  showPromptPreview: false,
} satisfies DeepPartial<EvaluatorStoreProps>;

/**
 * Default values for LLM evaluators.
 */
export const DEFAULT_LLM_EVALUATOR_STORE_VALUES = {
  ...DEFAULT_STORE_VALUES,
  evaluator: {
    ...DEFAULT_STORE_VALUES.evaluator,
    kind: "LLM",
    isBuiltin: false,
  },
  outputConfig: {
    name: "",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "", score: undefined },
      { label: "", score: undefined },
    ],
  },
} satisfies EvaluatorStoreProps;

/**
 * Default values for CODE evaluators.
 */
export const DEFAULT_CODE_EVALUATOR_STORE_VALUES = {
  ...DEFAULT_STORE_VALUES,
  evaluator: {
    ...DEFAULT_STORE_VALUES.evaluator,
    kind: "CODE",
    isBuiltin: true,
  },
} satisfies EvaluatorStoreProps;

export const createEvaluatorStore = (
  props: Partial<EvaluatorStoreProps> & { evaluator: { kind: EvaluatorKind } }
) => {
  return createStore<EvaluatorStore>()(
    devtools(
      (set, get) => {
        const properties = merge(
          DEFAULT_STORE_VALUES,
          props.evaluator.kind === "LLM"
            ? DEFAULT_LLM_EVALUATOR_STORE_VALUES
            : {},
          props.evaluator.kind === "CODE"
            ? DEFAULT_CODE_EVALUATOR_STORE_VALUES
            : {},
          props
        ) satisfies EvaluatorStoreProps;
        const actions = {
          setEvaluatorName(name) {
            set(
              { evaluator: { ...get().evaluator, name } },
              undefined,
              "setEvaluatorName"
            );
          },
          setEvaluatorDisplayName(displayName) {
            set(
              { evaluator: { ...get().evaluator, displayName } },
              undefined,
              "setEvaluatorDisplayName"
            );
          },
          setEvaluatorDescription(description) {
            set(
              { evaluator: { ...get().evaluator, description } },
              undefined,
              "setEvaluatorDescription"
            );
          },
          setOutputConfigName(name) {
            const baseOutputConfig =
              get().outputConfig ??
              DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfig;
            set(
              { outputConfig: { ...baseOutputConfig, name } },
              undefined,
              "setOutputConfigName"
            );
          },
          setOutputConfigOptimizationDirection(optimizationDirection) {
            const baseOutputConfig =
              get().outputConfig ??
              DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfig;
            set(
              {
                outputConfig: { ...baseOutputConfig, optimizationDirection },
              },
              undefined,
              "setOutputConfigOptimizationDirection"
            );
          },
          setOutputConfigValues(values) {
            const baseOutputConfig =
              get().outputConfig ??
              DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfig;
            set(
              { outputConfig: { ...baseOutputConfig, values } },
              undefined,
              "setOutputConfigValues"
            );
          },
          setPathMapping(pathMapping) {
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    pathMapping,
                  },
                },
              },
              undefined,
              "setPathMapping"
            );
          },
          setLiteralMapping(literalMapping) {
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    literalMapping,
                  },
                },
              },
              undefined,
              "setLiteralMapping"
            );
          },
          setInputMappingPath(path, value) {
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    pathMapping: {
                      ...get().evaluator.inputMapping.pathMapping,
                      [path]: value,
                    },
                  },
                },
              },
              undefined,
              "setInputMappingPath"
            );
          },
          setInputMappingLiteral(literal, value) {
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    literalMapping: {
                      ...get().evaluator.inputMapping.literalMapping,
                      [literal]: value,
                    },
                  },
                },
              },
              undefined,
              "setInputMappingLiteral"
            );
          },
          setDataset(dataset) {
            set({ dataset }, undefined, "setDataset");
          },
          setDatasetId(datasetId) {
            if (datasetId == null) {
              set({ dataset: undefined });
              return;
            }
            const baseDataset = get().dataset;
            invariant(baseDataset, "Dataset is required to set dataset id");
            set(
              { dataset: { ...baseDataset, id: datasetId } },
              undefined,
              "setDatasetId"
            );
          },
          setPreMappedInput(preMappedInput) {
            set({ preMappedInput }, undefined, "setPreMappedInput");
          },
          setSelectedExampleId(selectedExampleId) {
            const baseDataset = get().dataset;
            invariant(
              baseDataset,
              "Dataset is required to set selected example id"
            );
            set(
              {
                dataset: {
                  ...baseDataset,
                  selectedExampleId: selectedExampleId ?? null,
                },
              },
              undefined,
              "setSelectedExampleId"
            );
          },
          setSelectedSplitIds(selectedSplitIds) {
            const baseDataset = get().dataset;
            invariant(
              baseDataset,
              "Dataset is required to set selected split ids"
            );
            set(
              { dataset: { ...baseDataset, selectedSplitIds } },
              undefined,
              "setSelectedSplitIds"
            );
          },
          setShowPromptPreview(showPromptPreview) {
            set({ showPromptPreview }, undefined, "setShowPromptPreview");
          },
          setIncludeExplanation(includeExplanation) {
            set(
              { evaluator: { ...get().evaluator, includeExplanation } },
              undefined,
              "setIncludeExplanation"
            );
          },
        } satisfies EvaluatorStoreActions;
        return {
          ...properties,
          ...actions,
        };
      },
      {
        name: "evaluatorStore",
      }
    )
  );
};

export type EvaluatorStoreInstance = ReturnType<typeof createEvaluatorStore>;
