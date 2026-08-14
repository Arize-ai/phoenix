import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Alert,
  Flex,
  Input,
  NumberField,
  SegmentedControl,
  SegmentedControlItem,
  Slider,
  SliderNumberField,
  Text,
} from "@phoenix/components";
import {
  getSessionScopeUnschedulableReason,
  isProjectEvaluatorTarget,
  MIN_EVALUATION_DELAY_SECONDS,
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
  const isSessionTarget = scope.targetType === "SESSION";
  const unschedulableReason = getSessionScopeUnschedulableReason(scope);
  // A session evaluator only runs unfiltered and unsampled, so those controls
  // stay hidden unless a stored value is holding this evaluator back, in which
  // case they are the only way to clear it.
  const showSamplingField = !isSessionTarget || scope.samplingRate !== 1;
  const showFilterField = !isSessionTarget || scope.filterCondition !== "";
  const handleTargetChange = (targetType: ProjectEvaluatorTarget) => {
    if (targetType === "SESSION") {
      onScopeChange({
        ...scope,
        targetType,
        filterCondition: "",
        samplingRate: 1,
      });
      return;
    }
    onScopeChange({ ...scope, targetType });
  };
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-400" wrap alignItems="start">
        <ProjectEvaluatorTargetField
          value={scope.targetType}
          onChange={handleTargetChange}
          isDisabled={isTargetDisabled}
        />
        {isSessionTarget ? (
          <ProjectEvaluatorEvaluationDelayField
            value={scope.evaluationDelaySeconds}
            onChange={(evaluationDelaySeconds) =>
              onScopeChange({ ...scope, evaluationDelaySeconds })
            }
          />
        ) : null}
        {showSamplingField ? (
          <ProjectEvaluatorSamplingField
            fill={fillSampling}
            value={scope.samplingRate}
            onChange={(samplingRate) =>
              onScopeChange({ ...scope, samplingRate })
            }
          />
        ) : null}
        {children}
      </Flex>
      {showFilterField ? (
        <ProjectEvaluatorSpanFilterField
          projectId={projectId}
          targetType={scope.targetType}
          value={scope.filterCondition}
          onChange={(filterCondition) =>
            onScopeChange({ ...scope, filterCondition })
          }
          onValidityChange={onFilterValidityChange}
          showHint={!isSessionTarget}
        />
      ) : null}
      {isSessionTarget ? (
        <Text size="XS" color="text-500">
          Every session in this project is evaluated once, after it stays quiet
          for the evaluation delay. Later activity in the session does not
          schedule another evaluation.
        </Text>
      ) : null}
      {unschedulableReason ? (
        <Alert variant="warning" title="This evaluator will not run">
          {unschedulableReason === "filter"
            ? "Session evaluators with a filter are saved but never scheduled. Clear the span filter to schedule this evaluator."
            : "Session evaluators with a sampling rate below 100% are saved but never scheduled. Set sampling to 100% to schedule this evaluator."}
        </Alert>
      ) : null}
    </Flex>
  );
};

const ProjectEvaluatorEvaluationDelayField = ({
  value,
  onChange,
}: {
  /** Seconds a session must stay quiet before its evaluation is scheduled. */
  value: number;
  onChange: (evaluationDelaySeconds: number) => void;
}) => {
  return (
    <Flex direction="column" gap="size-50">
      <Text size="XS" weight="heavy" color="text-700">
        Evaluation delay
      </Text>
      <NumberField
        aria-label="Evaluation delay in seconds"
        size="S"
        step={1}
        minValue={MIN_EVALUATION_DELAY_SECONDS}
        value={value}
        onChange={onChange}
        css={css`
          width: 140px;
        `}
      >
        <Input />
      </NumberField>
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
        <SegmentedControlItem id="SESSION" isDisabled={isDisabled}>
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
  targetType,
  value,
  onChange,
  onValidityChange,
  showHint = true,
}: {
  projectId: string;
  /** Names the records the condition selects, in the label and the hint. */
  targetType: ProjectEvaluatorTarget;
  value: string;
  onChange: (filterCondition: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  /** Hidden where an empty filter is the only schedulable value. */
  showHint?: boolean;
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
        {targetType === "SESSION" ? "Session filter" : "Span filter"}
      </Text>
      <SpanFilterConditionFieldCore
        projectId={projectId}
        filterCondition={draft}
        onFilterConditionChange={setDraft}
        onValidCondition={handleValidCondition}
        onValidityChange={onValidityChange}
        placeholder="span_kind == 'LLM'"
      />
      {showHint ? (
        <Text size="XS" color="text-500">
          {targetType === "SESSION"
            ? "Leave empty to evaluate every session."
            : "Leave empty to evaluate every span."}
        </Text>
      ) : null}
    </Flex>
  );
};
