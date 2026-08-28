import { css } from "@emotion/react";
import { useEffect } from "react";

import {
  Flex,
  Heading,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { OptimizationDirectionField } from "@phoenix/components/evaluators/OptimizationDirectionField";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { FreeformEvaluatorAnnotationConfig } from "@phoenix/types";

export const createDefaultFreeformOutputConfig = (
  name: string
): FreeformEvaluatorAnnotationConfig => ({
  name,
  optimizationDirection: "NONE",
  threshold: null,
  lowerBound: null,
  upperBound: null,
});

/**
 * Heading + bordered card for the evaluator's output annotation config.
 */
export const CodeEvaluatorAnnotationSection = ({
  onChange,
}: {
  onChange?: () => void;
} = {}) => {
  return (
    <View flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Evaluator Annotation
        </Heading>
        <Text color="text-500">
          Define the annotation that your evaluator will create. Optimization
          direction, score range, and threshold apply only when your evaluator
          returns a numeric score.
        </Text>
        <View
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="default"
        >
          <OutputConfigSection onChange={onChange} />
        </View>
      </Flex>
    </View>
  );
};

const OutputConfigSection = ({ onChange }: { onChange?: () => void }) => {
  const store = useEvaluatorStoreInstance();
  const outputConfig = useEvaluatorStore((state) => state.outputConfigs[0]);
  const setOutputConfigThresholdAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigThresholdAtIndex
  );
  const setOutputConfigLowerBoundAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigLowerBoundAtIndex
  );
  const setOutputConfigUpperBoundAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigUpperBoundAtIndex
  );

  useEffect(() => {
    if (!outputConfig) {
      const state = store.getState();
      const name = state.evaluator.name || state.evaluator.globalName;
      state.setOutputConfigs([createDefaultFreeformOutputConfig(name)]);
    }
  }, [outputConfig, store]);

  if (!outputConfig) {
    return null;
  }

  if ("values" in outputConfig) {
    return (
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-200" alignItems="start">
          <TextField isDisabled value={outputConfig.name}>
            <Label>Name</Label>
            <Input />
          </TextField>
          <OptimizationDirectionField
            description="Whether higher or lower scores are better."
            onChange={onChange}
          />
        </Flex>
        <Flex direction="column" gap="size-100">
          <OutputConfigValuesHeader />
          {outputConfig.values.map((value, index) => (
            <OutputConfigValuesRow
              key={`${value.label}-${index}`}
              label={value.label}
              score={value.score ?? null}
              index={index}
            />
          ))}
        </Flex>
      </Flex>
    );
  }

  const threshold =
    "threshold" in outputConfig ? (outputConfig.threshold ?? null) : null;
  const lowerBound =
    "lowerBound" in outputConfig ? (outputConfig.lowerBound ?? null) : null;
  const upperBound =
    "upperBound" in outputConfig ? (outputConfig.upperBound ?? null) : null;
  const optimizationDirection = outputConfig.optimizationDirection;
  const isThresholdDisabled = optimizationDirection === "NONE";

  const thresholdDescription =
    optimizationDirection === "MAXIMIZE"
      ? "Scores at or above this value display as good; lower scores display as bad."
      : optimizationDirection === "MINIMIZE"
        ? "Scores at or below this value display as good; higher scores display as bad."
        : "Combined with the optimization direction, this is the cutoff used to visually distinguish “good” from “bad” scores.";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-200" alignItems="start">
        <TextField isDisabled value={outputConfig.name}>
          <Label>Name</Label>
          <Input />
        </TextField>
        <OptimizationDirectionField
          description="Whether higher or lower scores are better."
          onChange={onChange}
        />
        <NumberField
          value={threshold ?? undefined}
          onChange={(value) => {
            onChange?.();
            setOutputConfigThresholdAtIndex(
              0,
              Number.isNaN(value) ? null : value
            );
          }}
          isDisabled={isThresholdDisabled}
        >
          <Label>Score threshold (optional)</Label>
          <Input />
          <Text slot="description">{thresholdDescription}</Text>
        </NumberField>
      </Flex>
      <Flex direction="row" gap="size-200" alignItems="start">
        <NumberField
          value={lowerBound ?? undefined}
          onChange={(value) => {
            onChange?.();
            setOutputConfigLowerBoundAtIndex(
              0,
              Number.isNaN(value) ? null : value
            );
          }}
        >
          <Label>Minimum score (optional)</Label>
          <Input />
          <Text slot="description">
            The lowest score your evaluator is expected to produce.
          </Text>
        </NumberField>
        <NumberField
          value={upperBound ?? undefined}
          onChange={(value) => {
            onChange?.();
            setOutputConfigUpperBoundAtIndex(
              0,
              Number.isNaN(value) ? null : value
            );
          }}
        >
          <Label>Maximum score (optional)</Label>
          <Input />
          <Text slot="description">
            The highest score your evaluator is expected to produce.
          </Text>
        </NumberField>
      </Flex>
    </Flex>
  );
};

const OutputConfigValuesHeader = () => {
  return (
    <div css={outputConfigValuesGridCSS}>
      <Text>Choice</Text>
      <Text>Score</Text>
    </div>
  );
};

const OutputConfigValuesRow = ({
  label,
  score,
  index,
}: {
  label: string;
  score: number | null;
  index: number;
}) => {
  return (
    <div css={outputConfigValuesGridCSS}>
      <TextField isDisabled value={label} aria-label={`Choice ${index + 1}`}>
        <Input />
      </TextField>
      <TextField
        isDisabled
        value={score != null ? String(score) : ""}
        aria-label={`Score ${index + 1}`}
      >
        <Input />
      </TextField>
    </div>
  );
};

const outputConfigValuesGridCSS = css`
  width: 100%;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--global-dimension-size-100);
  align-items: start;
`;
