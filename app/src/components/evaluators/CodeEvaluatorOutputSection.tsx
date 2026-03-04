import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { useCallback, useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextField,
} from "@phoenix/components";
import { optimizationDirectionOptions } from "@phoenix/components/evaluators/OptimizationDirectionField";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import {
  DEFAULT_CODE_SOURCE_GENERIC,
  DEFAULT_CODE_SOURCE_LABEL,
  DEFAULT_CODE_SOURCE_LABEL_AND_SCORE,
  DEFAULT_CODE_SOURCE_SCORE,
} from "@phoenix/store/evaluatorStore";
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
} from "@phoenix/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const configPanelCSS = css`
  background-color: var(--global-background-color-dark);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-200);
  margin-top: var(--global-dimension-static-size-50);
  border: 1px solid var(--global-border-color-default);
`;

const optimizationDirectionSelectCSS = css`
  width: fit-content;
`;

const OptimizationDirectionSelect = ({
  value,
  onChange,
  "data-testid": testId,
}: {
  value: string;
  onChange: (value: string) => void;
  "data-testid"?: string;
}) => (
  <Select
    value={value}
    onChange={(v) => onChange(v as string)}
    aria-label="Optimization direction"
    data-testid={testId}
    css={optimizationDirectionSelectCSS}
  >
    <Label>Optimization direction</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {optimizationDirectionOptions.map((option) => (
          <SelectItem key={option.value} id={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </ListBox>
    </Popover>
  </Select>
);

/**
 * The three output shape options for CODE evaluators.
 * - "generic": passthrough mode, no output config constraints
 * - "score": a single continuous config (bare float return)
 * - "category": a single categorical config (bare string return)
 */
export type CodeEvaluatorOutputShape = "generic" | "score" | "category";

/**
 * Derives the output shape from the current store output configs.
 * Falls back to "generic" for unrecognized shapes.
 */
export function deriveOutputShape(
  outputConfigs: AnnotationConfig[]
): CodeEvaluatorOutputShape {
  if (outputConfigs.length === 0) {
    return "generic";
  }
  if (outputConfigs.length === 1) {
    const config = outputConfigs[0];
    if ("values" in config) {
      return "category";
    }
    return "score";
  }
  return "generic";
}

/**
 * Builds the default output config array for a given output shape.
 * Preserves the current config name when switching between single-config shapes.
 */
export function getDefaultConfigsForShape({
  shape,
  currentName,
}: {
  shape: CodeEvaluatorOutputShape;
  currentName: string;
}): AnnotationConfig[] {
  switch (shape) {
    case "generic":
      return [];
    case "category": {
      const config: ClassificationEvaluatorAnnotationConfig = {
        name: currentName,
        optimizationDirection: "NONE",
        values: [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      };
      return [config];
    }
    case "score": {
      const config: ContinuousEvaluatorAnnotationConfig = {
        name: currentName,
        optimizationDirection: "NONE",
        lowerBound: null,
        upperBound: null,
      };
      return [config];
    }
  }
}

type CodeLabelFormValues = {
  outputConfig: ClassificationEvaluatorAnnotationConfig;
};

const useCodeLabelForm = () => {
  const store = useEvaluatorStoreInstance();
  const outputConfig = useEvaluatorStore(
    useShallow((state) => {
      const firstConfig = state.outputConfigs[0];
      return firstConfig && "values" in firstConfig ? firstConfig : undefined;
    })
  );

  const form = useForm<CodeLabelFormValues>({
    defaultValues: {
      outputConfig: outputConfig ?? {
        name: "",
        optimizationDirection: "NONE",
        values: [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      },
    },
    mode: "onChange",
  });

  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { outputConfig }, isValid }) {
        if (!isValid) {
          return;
        }
        if (!("values" in outputConfig)) {
          return;
        }
        const {
          setOutputConfigOptimizationDirectionAtIndex,
          setOutputConfigValuesAtIndex,
        } = store.getState();
        setOutputConfigOptimizationDirectionAtIndex(
          0,
          outputConfig.optimizationDirection
        );
        setOutputConfigValuesAtIndex(0, outputConfig.values);
      },
    });
  }, [subscribe, store]);

  const triggerValidation = useCallback(async () => {
    return form.trigger();
  }, [form]);
  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator("code_label_choices", triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  return form;
};

export const CodeEvaluatorLabelConfig = () => {
  const { control } = useCodeLabelForm();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "outputConfig.values",
  });
  return (
    <div css={configPanelCSS}>
      <Flex direction="column" gap="size-200">
        <Controller
          control={control}
          name="outputConfig.optimizationDirection"
          render={({ field }) => (
            <OptimizationDirectionSelect
              value={field.value}
              onChange={field.onChange}
              data-testid="code-label-optimization-direction-picker"
            />
          )}
        />
        <Flex direction="column" gap="size-100">
          <LabelGridRow>
            <Text>Choice</Text>
            <Text>Score</Text>
          </LabelGridRow>
          {fields.map((item, index) => (
            <LabelGridRow key={item.id}>
              <Controller
                control={control}
                name={`outputConfig.values.${index}.label`}
                rules={{
                  required: "Choice label is required",
                }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    aria-label={`Choice ${index + 1}`}
                    isInvalid={!!error}
                    css={css`
                      flex: 1 1 auto;
                      flex-shrink: 1;
                    `}
                  >
                    <Input
                      placeholder={`e.g. ${ALPHABET[index % ALPHABET.length]}`}
                    />
                    <FieldError>{error?.message}</FieldError>
                  </TextField>
                )}
              />
              <Flex direction="row" gap="size-100" alignItems="center">
                <Controller
                  control={control}
                  name={`outputConfig.values.${index}.score`}
                  render={({ field, fieldState: { error } }) => (
                    <NumberField
                      {...field}
                      value={
                        typeof field.value === "number"
                          ? field.value
                          : undefined
                      }
                      aria-label={`Score ${index + 1}`}
                      isInvalid={!!error}
                      css={css`
                        width: 100%;
                      `}
                    >
                      <Input
                        placeholder={`e.g. ${index} (optional)`}
                        className="react-aria-Input"
                        css={css`
                          width: 100%;
                        `}
                      />
                      <FieldError>{error?.message}</FieldError>
                    </NumberField>
                  )}
                />
                {index > 1 && (
                  <Button
                    type="button"
                    leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                    aria-label="Remove choice"
                    onPress={() => {
                      if (fields.length <= 2) {
                        return;
                      }
                      remove(index);
                    }}
                  />
                )}
              </Flex>
            </LabelGridRow>
          ))}
          <Flex alignItems="center" justifyContent="end">
            <Button
              type="button"
              size="S"
              variant="quiet"
              css={css`
                width: fit-content;
              `}
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              aria-label="Add choice"
              onPress={() => {
                append({ label: "", score: undefined });
              }}
            >
              Add choice
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};

type CodeScoreFormValues = {
  optimizationDirection: ContinuousEvaluatorAnnotationConfig["optimizationDirection"];
  lowerBound: number | null;
  upperBound: number | null;
};

const useCodeScoreForm = () => {
  const store = useEvaluatorStoreInstance();
  const { continuousConfig, continuousIndex } = useEvaluatorStore(
    useShallow((state) => {
      const idx = state.outputConfigs.findIndex((c) => !("values" in c));
      const config =
        idx >= 0
          ? (state.outputConfigs[idx] as ContinuousEvaluatorAnnotationConfig)
          : undefined;
      return { continuousConfig: config, continuousIndex: idx };
    })
  );

  const form = useForm<CodeScoreFormValues>({
    defaultValues: {
      optimizationDirection: continuousConfig?.optimizationDirection ?? "NONE",
      lowerBound: continuousConfig?.lowerBound ?? null,
      upperBound: continuousConfig?.upperBound ?? null,
    },
    mode: "onChange",
  });

  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values, isValid }) {
        if (!isValid || continuousIndex < 0) {
          return;
        }
        const { updateOutputConfig } = store.getState();
        updateOutputConfig(continuousIndex, {
          optimizationDirection: values.optimizationDirection,
          lowerBound: values.lowerBound,
          upperBound: values.upperBound,
        });
      },
    });
  }, [subscribe, store, continuousIndex]);

  const triggerValidation = useCallback(async () => {
    return form.trigger();
  }, [form]);
  useEffect(() => {
    const unregister = store
      .getState()
      .registerValidator("code_score_bounds", triggerValidation);
    return unregister;
  }, [store, triggerValidation]);

  return form;
};

export const CodeEvaluatorScoreConfig = () => {
  const { control } = useCodeScoreForm();
  return (
    <div css={configPanelCSS}>
      <Flex direction="column" gap="size-200">
        <Controller
          control={control}
          name="optimizationDirection"
          render={({ field }) => (
            <OptimizationDirectionSelect
              value={field.value}
              onChange={field.onChange}
              data-testid="code-score-optimization-direction-picker"
            />
          )}
        />
        <Flex direction="row" gap="size-200">
          <Controller
            control={control}
            name="lowerBound"
            rules={{
              validate: (value, formValues) => {
                if (
                  value != null &&
                  formValues.upperBound != null &&
                  value >= formValues.upperBound
                ) {
                  return "Lower bound must be less than upper bound";
                }
                return true;
              },
            }}
            render={({ field, fieldState: { error } }) => (
              <NumberField
                value={field.value ?? undefined}
                onChange={(v) => field.onChange(v ?? null)}
                aria-label="Lower bound"
                isInvalid={!!error}
                css={css`
                  flex: 1;
                `}
              >
                <Label>Lower bound</Label>
                <Input placeholder="Unbounded" className="react-aria-Input" />
                <FieldError>{error?.message}</FieldError>
              </NumberField>
            )}
          />
          <Controller
            control={control}
            name="upperBound"
            rules={{
              validate: (value, formValues) => {
                if (
                  value != null &&
                  formValues.lowerBound != null &&
                  value <= formValues.lowerBound
                ) {
                  return "Upper bound must be greater than lower bound";
                }
                return true;
              },
            }}
            render={({ field, fieldState: { error } }) => (
              <NumberField
                value={field.value ?? undefined}
                onChange={(v) => field.onChange(v ?? null)}
                aria-label="Upper bound"
                isInvalid={!!error}
                css={css`
                  flex: 1;
                `}
              >
                <Label>Upper bound</Label>
                <Input placeholder="Unbounded" className="react-aria-Input" />
                <FieldError>{error?.message}</FieldError>
              </NumberField>
            )}
          />
        </Flex>
      </Flex>
    </div>
  );
};

const ALL_CODE_TEMPLATES = [
  DEFAULT_CODE_SOURCE_GENERIC,
  DEFAULT_CODE_SOURCE_SCORE,
  DEFAULT_CODE_SOURCE_LABEL,
  DEFAULT_CODE_SOURCE_LABEL_AND_SCORE,
];

function getTemplateForShape(shape: CodeEvaluatorOutputShape): string {
  switch (shape) {
    case "generic":
      return DEFAULT_CODE_SOURCE_GENERIC;
    case "score":
      return DEFAULT_CODE_SOURCE_SCORE;
    case "category":
      return DEFAULT_CODE_SOURCE_LABEL;
  }
}

const outputShapeOptions: { value: CodeEvaluatorOutputShape; label: string }[] =
  [
    { value: "generic", label: "None" },
    { value: "score", label: "Score" },
    { value: "category", label: "Category" },
  ];

const HELP_TEXT: Record<CodeEvaluatorOutputShape, string> = {
  generic:
    'No output constraints. Your function can return a bare float, a bare string, or a dict with any of "score", "label", and "explanation" keys.',
  score:
    'Return a number. Your function can return a bare float (e.g. return 0.75) or a dict with a "score" key (e.g. return {"score": 0.75}). Optionally include an "explanation" key in the dict for a human-readable rationale. If you set bounds, the score must fall within them.',
  category:
    'Return a string matching one of the labels you configure below. Your function can return a bare string (e.g. return "good") or a dict with a "label" key (e.g. return {"label": "good"}). Optionally include an "explanation" key in the dict.',
};

export const CodeEvaluatorOutputSection = () => {
  const store = useEvaluatorStoreInstance();
  const { outputConfigs, setOutputConfigs } = useEvaluatorStore(
    useShallow((state) => ({
      outputConfigs: state.outputConfigs,
      setOutputConfigs: state.setOutputConfigs,
    }))
  );
  const selectedShape = deriveOutputShape(outputConfigs);

  return (
    <Flex direction="column" gap="size-100">
      <Select
        value={selectedShape}
        onChange={(value) => {
          const newShape = value as CodeEvaluatorOutputShape;
          if (newShape === selectedShape) return;
          const currentName = outputConfigs[0]?.name ?? "";
          setOutputConfigs(
            getDefaultConfigsForShape({
              shape: newShape,
              currentName,
            })
          );
          // If the user hasn't customized the source code (it still matches a
          // known default template), swap it to the template for the new shape.
          const { sourceCode, setSourceCode } = store.getState();
          if (ALL_CODE_TEMPLATES.includes(sourceCode)) {
            setSourceCode(getTemplateForShape(newShape));
          }
        }}
        aria-label="Output shape"
        data-testid="code-evaluator-output-shape-picker"
        css={css`
          width: fit-content;
        `}
      >
        <Label>Output shape</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            {outputShapeOptions.map((option) => (
              <SelectItem key={option.value} id={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <Text
        color="text-700"
        css={css`
          font-size: var(--global-font-size-s);
        `}
      >
        {HELP_TEXT[selectedShape]}
      </Text>
      {selectedShape === "category" && <CodeEvaluatorLabelConfig />}
      {selectedShape === "score" && <CodeEvaluatorScoreConfig />}
    </Flex>
  );
};

const LabelGridRow = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        width: 100%;
        display: grid;
        grid-template-columns: 3fr 1fr;
        gap: var(--global-dimension-static-size-100);
        align-items: start;
      `}
    >
      {children}
    </div>
  );
};
