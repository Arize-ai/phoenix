import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import {
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
  isProjectEvaluatorTarget,
  MIN_EVALUATION_DELAY_SECONDS,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  EMPTY_SESSION_FILTER_VOCABULARY,
  SessionFilterConditionFieldCore,
  type SessionFilterConditionFieldCoreProps,
  useSessionFilterVocabulary,
} from "@phoenix/pages/project/SessionFilterConditionField";
import {
  SpanFilterConditionFieldCore,
  type SpanFilterValidConditionArgs,
} from "@phoenix/pages/project/SpanFilterConditionField";

/**
 * The target, sampling, delay, and filter fields wired to a scope object.
 * `children` renders additional fields at the end of the first row, after
 * every setting the scope persists.
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
  // Spans and sessions are filtered in different languages, so a condition
  // written for one target cannot carry over to the other.
  const handleTargetChange = (targetType: ProjectEvaluatorTarget) => {
    if (targetType === scope.targetType) {
      return;
    }
    onScopeChange({ ...scope, targetType, filterCondition: "" });
  };
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-400" wrap alignItems="start">
        <ProjectEvaluatorTargetField
          value={scope.targetType}
          onChange={handleTargetChange}
          isDisabled={isTargetDisabled}
        />
        <ProjectEvaluatorSamplingField
          // A filled slider takes the whole row, which would wrap the delay
          // field onto a line of its own.
          fill={fillSampling && !isSessionTarget}
          value={scope.samplingRate}
          onChange={(samplingRate) => onScopeChange({ ...scope, samplingRate })}
        />
        {isSessionTarget ? (
          <ProjectEvaluatorEvaluationDelayField
            value={scope.evaluationDelaySeconds}
            onChange={(evaluationDelaySeconds) =>
              onScopeChange({ ...scope, evaluationDelaySeconds })
            }
          />
        ) : null}
        {children}
      </Flex>
      {isSessionTarget ? (
        <Text size="XS" color="text-500">
          Sessions are evaluated after this many seconds of inactivity.
        </Text>
      ) : null}
      {/* Remounted per target so the draft condition does not survive a switch
          into a language that cannot parse it. */}
      <ProjectEvaluatorFilterField
        key={scope.targetType}
        projectId={projectId}
        targetType={scope.targetType}
        value={scope.filterCondition}
        onChange={(filterCondition) =>
          onScopeChange({ ...scope, filterCondition })
        }
        onValidityChange={onFilterValidityChange}
      />
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
      {/* Stays at the default M size so it lines up with the segmented
          control, slider, and select sharing this row. */}
      <NumberField
        aria-label="Evaluation delay in seconds"
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
 * The filter for whichever records the target names, with its own draft state:
 * only validated conditions are lifted into the committed scope via `onChange`.
 */
const ProjectEvaluatorFilterField = ({
  projectId,
  targetType,
  value,
  onChange,
  onValidityChange,
}: {
  projectId: string;
  /** Picks the filter language, and names the records in the label and hint. */
  targetType: ProjectEvaluatorTarget;
  value: string;
  onChange: (filterCondition: string) => void;
  onValidityChange?: (isValid: boolean) => void;
}) => {
  const isSessionTarget = targetType === "SESSION";
  const [draft, setDraft] = useState(value);
  const applyValidCondition = (filterCondition: string) => {
    if (filterCondition === value) {
      return;
    }
    onChange(filterCondition);
  };
  return (
    <Flex direction="column" gap="size-50">
      <Text size="XS" weight="heavy" color="text-700">
        {isSessionTarget ? "Session filter" : "Span filter"}
      </Text>
      {isSessionTarget ? (
        <SessionScopeFilterField
          projectId={projectId}
          filterCondition={draft}
          onFilterConditionChange={setDraft}
          onValidCondition={applyValidCondition}
          onValidityChange={onValidityChange}
          placeholder="num_traces >= 5"
        />
      ) : (
        <SpanFilterConditionFieldCore
          projectId={projectId}
          filterCondition={draft}
          onFilterConditionChange={setDraft}
          onValidCondition={({ condition }: SpanFilterValidConditionArgs) =>
            applyValidCondition(condition)
          }
          onValidityChange={onValidityChange}
          placeholder="span_kind == 'LLM'"
        />
      )}
      <Text size="XS" color="text-500">
        {isSessionTarget
          ? "Leave empty to evaluate every session."
          : "Leave empty to evaluate every span."}
      </Text>
    </Flex>
  );
};

/**
 * Autocomplete data must not gate the field, so it filters with an empty
 * vocabulary until the project's vocabulary arrives.
 */
function SessionScopeFilterField(
  props: Omit<SessionFilterConditionFieldCoreProps, "vocabulary">
) {
  return (
    <Suspense
      fallback={
        <SessionFilterConditionFieldCore
          {...props}
          vocabulary={EMPTY_SESSION_FILTER_VOCABULARY}
        />
      }
    >
      <SessionScopeFilterFieldWithVocabulary {...props} />
    </Suspense>
  );
}

function SessionScopeFilterFieldWithVocabulary(
  props: Omit<SessionFilterConditionFieldCoreProps, "vocabulary">
) {
  const vocabulary = useSessionFilterVocabulary(props.projectId);
  return <SessionFilterConditionFieldCore {...props} vocabulary={vocabulary} />;
}
