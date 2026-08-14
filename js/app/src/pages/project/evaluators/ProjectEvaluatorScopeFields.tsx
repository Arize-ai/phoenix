import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Flex,
  SegmentedControl,
  SegmentedControlItem,
  Slider,
  SliderNumberField,
  Text,
} from "@phoenix/components";
import {
  isProjectEvaluatorTarget,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  SpanFilterConditionFieldCore,
  type SpanFilterValidConditionArgs,
} from "@phoenix/pages/project/SpanFilterConditionField";

/**
 * The target, sampling, and span-filter fields wired to a scope object.
 * `children` renders additional fields in the first row after sampling.
 */
export const ProjectEvaluatorScopeFieldGroup = ({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  isTargetDisabled = false,
  fillSampling = false,
  children,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  isTargetDisabled?: boolean;
  /** Grow the sampling slider to fill the row. */
  fillSampling?: boolean;
  children?: ReactNode;
}) => {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-400" wrap alignItems="start">
        <ProjectEvaluatorTargetField
          value={scope.targetType}
          onChange={(targetType) => onScopeChange({ ...scope, targetType })}
          isDisabled={isTargetDisabled}
        />
        <ProjectEvaluatorSamplingField
          fill={fillSampling}
          value={scope.samplingRate}
          onChange={(samplingRate) => onScopeChange({ ...scope, samplingRate })}
        />
        {children}
      </Flex>
      <ProjectEvaluatorSpanFilterField
        projectId={projectId}
        value={scope.filterCondition}
        onChange={(filterCondition) =>
          onScopeChange({ ...scope, filterCondition })
        }
        onValidityChange={onFilterValidityChange}
      />
    </Flex>
  );
};

const ProjectEvaluatorTargetField = ({
  value,
  onChange,
  isDisabled = false,
}: {
  value: ProjectEvaluatorTarget;
  onChange: (target: ProjectEvaluatorTarget) => void;
  isDisabled?: boolean;
}) => {
  return (
    <Flex direction="column" gap="size-50" flex="none">
      <Text size="XS" weight="heavy" color="text-700">
        Target
      </Text>
      <SegmentedControl
        aria-label="Evaluator target"
        selectedKey={value}
        onSelectionChange={(key) => {
          if (typeof key === "string" && isProjectEvaluatorTarget(key)) {
            onChange(key);
          }
        }}
      >
        <SegmentedControlItem id="SPAN" isDisabled={isDisabled}>
          Span
        </SegmentedControlItem>
        <SegmentedControlItem id="SESSION" isDisabled>
          Session
        </SegmentedControlItem>
      </SegmentedControl>
    </Flex>
  );
};

const ProjectEvaluatorSamplingField = ({
  value,
  onChange,
  fill = false,
}: {
  /** Sampling rate as a fraction in [0, 1]. */
  value: number;
  onChange: (samplingRate: number) => void;
  /** Grow to fill the row instead of the default fixed track width. */
  fill?: boolean;
}) => {
  return (
    <Flex direction="column" gap="size-50" flex={fill ? "1 1 auto" : undefined}>
      <Text size="XS" weight="heavy" color="text-700">
        Sampling
      </Text>
      <Slider
        aria-label="Sampling rate"
        css={fill ? samplingSliderFillCSS : samplingSliderCSS}
        minValue={0}
        maxValue={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(samplingRatePercent) =>
          onChange(toProjectEvaluatorSamplingFraction(samplingRatePercent))
        }
        thumbLabels={["Sampling rate percentage"]}
      >
        <SliderNumberField
          aria-label="Sampling rate percentage"
          formatOptions={{
            style: "unit",
            unit: "percent",
            unitDisplay: "narrow",
          }}
        />
      </Slider>
    </Flex>
  );
};

const samplingSliderCSS = css`
  grid-template-areas: "track output";
  grid-template-columns: 1fr auto;
  align-items: center;
  /* Match the specificity of the base component's orientation rule, which
     otherwise wins with width: 100% and collapses the track. */
  &[data-orientation="horizontal"] {
    width: 220px;
    height: var(--global-input-height-m);
  }
  .slider__output {
    display: flex;
    align-items: center;
    min-height: 0;
  }
  /* The base slider styles this input under an orientation-qualified selector;
     restate that qualification so these later, equal-specificity rules win. */
  &[data-orientation="horizontal"] .slider__number-field .react-aria-Input {
    margin-bottom: 0;
    height: var(--global-input-height-m);
  }
`;

const samplingSliderFillCSS = css`
  ${samplingSliderCSS};
  &[data-orientation="horizontal"] {
    width: 100%;
    min-width: 220px;
  }
`;

/**
 * The span filter with its own draft state: only validated conditions are
 * lifted into the committed scope via `onChange`.
 */
const ProjectEvaluatorSpanFilterField = ({
  projectId,
  value,
  onChange,
  onValidityChange,
}: {
  projectId: string;
  value: string;
  onChange: (filterCondition: string) => void;
  onValidityChange?: (isValid: boolean) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const handleValidCondition = ({
    condition: filterCondition,
  }: SpanFilterValidConditionArgs) => {
    if (filterCondition === value) {
      return;
    }
    onChange(filterCondition);
  };
  return (
    <Flex direction="column" gap="size-50">
      <Text size="XS" weight="heavy" color="text-700">
        Span filter
      </Text>
      <SpanFilterConditionFieldCore
        projectId={projectId}
        filterCondition={draft}
        onFilterConditionChange={setDraft}
        onValidCondition={handleValidCondition}
        onValidityChange={onValidityChange}
        placeholder="span_kind == 'LLM'"
      />
      <Text size="XS" color="text-500">
        Leave empty to evaluate every span.
      </Text>
    </Flex>
  );
};
