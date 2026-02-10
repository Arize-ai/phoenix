import merge from "lodash/merge";
import invariant from "tiny-invariant";
import { createStore } from "zustand";
import { devtools } from "zustand/middleware";

import { DEFAULT_EVALUATOR_TEMPLATE } from "@phoenix/components/evaluators/templates/defaultEvaluatorTemplate";
import type {
  ClassificationChoice,
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
  EvaluatorKind,
  EvaluatorMappingSource,
  EvaluatorOptimizationDirection,
} from "@phoenix/types";
import type { DeepPartial } from "@phoenix/typeUtils";
import { compressObject } from "@phoenix/utils/objectUtils";

export type EvaluatorStoreProps = {
  datasetEvaluator?: {
    id: string;
  };
  evaluator: {
    id?: string;
    /** The global/internal name of the base evaluator (e.g., "hallucination") */
    globalName: string;
    /** The user-facing name for this dataset evaluator instance */
    name: string;
    inputMapping: EvaluatorInputMapping;
    kind: EvaluatorKind;
    description: string;
    isBuiltin: boolean;
    includeExplanation: boolean;
  };
  outputConfig?:
    | ClassificationEvaluatorAnnotationConfig
    | ContinuousEvaluatorAnnotationConfig;
  dataset?: {
    id: string;
    readonly: boolean;
    selectedExampleId: string | null;
    selectedSplitIds: string[];
  };
  evaluatorMappingSource: EvaluatorMappingSource;
  showPromptPreview: boolean;
};

export type EvaluatorStoreActions = {
  /** Sets the global/internal name of the base evaluator. */
  setEvaluatorGlobalName: (globalName: string) => void;
  /** Sets the user-facing name for this dataset evaluator instance. */
  setEvaluatorName: (name: string) => void;
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
  /** Sets the evaluator mapping source data (input, output, reference). */
  setEvaluatorMappingSource: (
    evaluatorMappingSource: EvaluatorMappingSource
  ) => void;
  /** Sets a single field of the evaluator mapping source. */
  setEvaluatorMappingSourceField: (
    field: keyof EvaluatorMappingSource,
    value: Record<string, unknown>
  ) => void;
  /** Sets the currently selected example ID within the dataset. */
  setSelectedExampleId: (selectedExampleId?: string | null) => void;
  /** Sets the selected split IDs for filtering dataset examples. */
  setSelectedSplitIds: (selectedSplitIds: string[]) => void;
  /** Sets whether to show the prompt preview panel. */
  setShowPromptPreview: (showPromptPreview: boolean) => void;
};

export type EvaluatorStore = EvaluatorStoreProps & EvaluatorStoreActions;

/**
 * Default value for the evaluator mapping source.
 */
export const EVALUATOR_MAPPING_SOURCE_DEFAULT: EvaluatorMappingSource = {
  input: {},
  output: {
    messages: [
      {
        role: "assistant",
        content: "[SAMPLE] Replace this with your actual task output format",
        tool_calls: [
          {
            function: {
              name: "example_function",
              arguments: '{"param": "example_value"}',
            },
          },
        ],
      },
    ],
    available_tools: [
      {
        type: "function",
        function: {
          name: "example_function",
          description: "[SAMPLE] Example tool definition",
          parameters: {
            type: "object",
            properties: {
              param: {
                type: "string",
                description: "Example parameter",
              },
            },
            required: ["param"],
          },
        },
      },
    ],
  },
  reference: {},
  metadata: {},
};

/**
 * Default value for the evaluator mapping source as a string.
 */
export const EVALUATOR_MAPPING_SOURCE_DEFAULT_STRING = JSON.stringify(
  EVALUATOR_MAPPING_SOURCE_DEFAULT,
  null,
  2
);

/**
 * Common default values for all evaluator kinds.
 */
export const DEFAULT_STORE_VALUES = {
  evaluator: {
    globalName: "",
    name: "",
    description: "",
    inputMapping: {
      literalMapping: {},
      pathMapping: {},
    },
    includeExplanation: true,
  },
  evaluatorMappingSource: EVALUATOR_MAPPING_SOURCE_DEFAULT,
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
  outputConfig: { ...DEFAULT_EVALUATOR_TEMPLATE.outputConfig },
} satisfies EvaluatorStoreProps;

/**
 * Default values for CODE evaluators.
 */
export const DEFAULT_CODE_EVALUATOR_STORE_VALUES = {
  ...DEFAULT_STORE_VALUES,
  evaluator: {
    ...DEFAULT_STORE_VALUES.evaluator,
    kind: "BUILTIN",
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
          {},
          DEFAULT_STORE_VALUES,
          props.evaluator.kind === "LLM"
            ? DEFAULT_LLM_EVALUATOR_STORE_VALUES
            : {},
          props.evaluator.kind === "BUILTIN"
            ? DEFAULT_CODE_EVALUATOR_STORE_VALUES
            : {},
          props
        ) satisfies EvaluatorStoreProps;
        const actions = {
          setEvaluatorGlobalName(globalName) {
            set(
              {
                evaluator: { ...get().evaluator, globalName },
                // synchronize the output config name with the evaluator name
              },
              undefined,
              "setEvaluatorGlobalName"
            );
            get().setOutputConfigName(globalName);
          },
          setEvaluatorName(name) {
            set(
              {
                evaluator: { ...get().evaluator, name },
              },
              undefined,
              "setEvaluatorName"
            );
            get().setOutputConfigName(name);
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
            const newPathMapping =
              // filter out undefined and empty key value pairs
              compressObject(pathMapping) ?? {};
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    // We have to perform this cast because the type system cannot distinguish between
                    // a partial object where some keys are actually missing, and a partial object where some keys have undefined values.
                    pathMapping: newPathMapping as unknown as Record<
                      string,
                      string
                    >,
                  },
                },
              },
              undefined,
              "setPathMapping"
            );
          },
          setLiteralMapping(literalMapping) {
            const newLiteralMapping =
              // filter out undefined and empty key value pairs
              compressObject(literalMapping) ?? {};
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    literalMapping: newLiteralMapping as unknown as Record<
                      string,
                      boolean | string | number
                    >,
                  },
                },
              },
              undefined,
              "setLiteralMapping"
            );
          },
          setInputMappingPath(path, value) {
            const newPathMapping =
              // filter out undefined and empty key value pairs
              compressObject({
                ...get().evaluator.inputMapping.pathMapping,
                [path]: value,
              }) ?? {};
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    // We have to perform this cast because the type system cannot distinguish between
                    // a partial object where some keys are actually missing, and a partial object where some keys have undefined values.
                    pathMapping: newPathMapping as unknown as Record<
                      string,
                      string
                    >,
                  },
                },
              },
              undefined,
              "setInputMappingPath"
            );
          },
          setInputMappingLiteral(literal, value) {
            const newLiteralMapping =
              // filter out undefined and empty key value pairs
              compressObject({
                ...get().evaluator.inputMapping.literalMapping,
                [literal]: value,
              }) ?? {};
            set(
              {
                evaluator: {
                  ...get().evaluator,
                  inputMapping: {
                    ...get().evaluator.inputMapping,
                    literalMapping: newLiteralMapping as unknown as Record<
                      string,
                      boolean | string | number
                    >,
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
          setEvaluatorMappingSource(evaluatorMappingSource) {
            set(
              { evaluatorMappingSource },
              undefined,
              "setEvaluatorMappingSource"
            );
          },
          setEvaluatorMappingSourceField(field, value) {
            set(
              {
                evaluatorMappingSource: {
                  ...get().evaluatorMappingSource,
                  [field]: value,
                },
              },
              undefined,
              "setEvaluatorMappingSourceField"
            );
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
