import { css } from "@emotion/react";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Heading,
  Input,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { useTimeRange } from "@phoenix/components/datetime";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { ProjectEvaluatorFormSectionsMatchedCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorFormSectionsMatchedCountQuery.graphql";
import { ProjectEvaluatorTargetField } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetField";
import type {
  ProjectEvaluatorScope,
  ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";

/**
 * The left-panel creation/edit flow for a project evaluator: a compact scope
 * card (target, filter, sampling, live matched-span count), the always-visible
 * evaluator definition, and a collapsed-by-default advanced-mapping disclosure
 * that summarizes its state while closed.
 */
export const ProjectEvaluatorFormSections = ({
  projectId,
  scope,
  onScopeChange,
  definitionKind,
  codeEvaluatorName,
  codeDefinition,
  onFilterValidityChange,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  definitionKind: "llm" | "code" | "newCode";
  codeEvaluatorName?: string;
  /** Authoring fields rendered in the definition section when `newCode`. */
  codeDefinition?: ReactNode;
  onFilterValidityChange?: (isValid: boolean) => void;
}) => {
  // The editor's live text; only validated conditions are lifted into `scope`.
  const [filterConditionDraft, setFilterConditionDraft] = useState(
    scope.filterCondition
  );
  const updateTarget = (targetType: ProjectEvaluatorTarget) => {
    onScopeChange({ ...scope, targetType });
  };
  // The filter field re-invokes `onValidCondition` on every validation pass, so
  // this callback must not capture `scope` directly: a fresh closure per scope
  // change would re-fire the field's validation effect each render. Read the
  // latest scope through a ref and only lift when the validated condition
  // actually differs.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const handleValidCondition = (filterCondition: string) => {
    const currentScope = scopeRef.current;
    if (filterCondition === currentScope.filterCondition) {
      return;
    }
    onScopeChange({ ...currentScope, filterCondition });
  };
  return (
    <Flex direction="column" gap="size-200">
      <View
        borderWidth="thin"
        borderColor="default"
        borderRadius="medium"
        padding="size-200"
        flex="none"
      >
        <Flex direction="column" gap="size-200">
          <Flex direction="column" gap="size-25">
            <Heading level={2}>Scope</Heading>
            <Text color="text-500" size="S">
              Which spans run this evaluator, and how often.
            </Text>
          </Flex>
          <Flex direction="row" gap="size-400" wrap alignItems="start">
            <ProjectEvaluatorTargetField
              value={scope.targetType}
              onChange={updateTarget}
            />
            <Flex direction="column" gap="size-50">
              <Text size="XS" weight="heavy" color="text-700">
                Sampling
              </Text>
              <Slider
                aria-label="Sampling rate"
                css={samplingSliderCSS}
                minValue={0}
                maxValue={100}
                step={1}
                value={scope.samplingRatePercent}
                onChange={(samplingRatePercent) =>
                  onScopeChange({ ...scope, samplingRatePercent })
                }
                thumbLabels={["Sampling rate percentage"]}
              >
                <SliderNumberField aria-label="Sampling rate percentage">
                  <Input />
                </SliderNumberField>
                <Text color="text-500">%</Text>
              </Slider>
            </Flex>
          </Flex>
          <Flex direction="column" gap="size-50">
            <Text size="XS" weight="heavy" color="text-700">
              Span filter
            </Text>
            <SpanFilterConditionFieldCore
              projectId={projectId}
              filterCondition={filterConditionDraft}
              onFilterConditionChange={setFilterConditionDraft}
              onValidCondition={handleValidCondition}
              onValidityChange={onFilterValidityChange}
              placeholder="span_kind == 'LLM'"
            />
            <Text size="XS" color="text-500">
              Leave empty to evaluate every span.
            </Text>
          </Flex>
          <Suspense
            fallback={
              <Text size="S" color="text-500">
                Counting matching spans…
              </Text>
            }
          >
            <MatchedSpanCountLine
              projectId={projectId}
              filterCondition={scope.filterCondition}
            />
          </Suspense>
        </Flex>
      </View>
      <Flex direction="column" gap="size-200" flex="none">
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Evaluator</Heading>
          <Text color="text-500" size="S">
            {definitionKind === "llm"
              ? "The judge that runs on each matched span."
              : definitionKind === "newCode"
                ? "Author the evaluator's source code and annotation output."
                : "Attach the selected code evaluator to this project."}
          </Text>
        </Flex>
        {definitionKind === "llm" ? (
          <Flex direction="column" gap="size-200">
            <EvaluatorNameAndDescriptionFields />
            <LLMEvaluatorForm showInputMapping={false} />
          </Flex>
        ) : definitionKind === "newCode" ? (
          codeDefinition
        ) : (
          <View
            borderRadius="medium"
            borderWidth="thin"
            borderColor="default"
            padding="size-200"
          >
            <Heading level={3}>{codeEvaluatorName}</Heading>
          </View>
        )}
      </Flex>
      <AdvancedMappingDisclosure />
    </Flex>
  );
};

/**
 * Lays the sampling slider out as one compact row — track, then value and "%"
 * inline — instead of the default label/value-over-track grid, whose output
 * cell stacks the "%" beneath the number field.
 */
const samplingSliderCSS = css`
  grid-template-areas: "track output";
  grid-template-columns: 1fr auto;
  align-items: center;
  /* Match the specificity of the base component's orientation rule, which
     otherwise wins with width: 100% and collapses the track. */
  &[data-orientation="horizontal"] {
    width: 260px;
  }
  .slider__output {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-height: 0;
  }
  .slider__number-field .react-aria-Input {
    margin-bottom: 0;
  }
`;

const MatchedSpanCountLine = ({
  projectId,
  filterCondition,
}: {
  projectId: string;
  filterCondition: string;
}) => {
  // Count within the page's selected time range so the number always agrees
  // with the spans shown in the preview panel.
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<ProjectEvaluatorFormSectionsMatchedCountQuery>(
    graphql`
      query ProjectEvaluatorFormSectionsMatchedCountQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanCountTimeSeries(
              timeRange: $timeRange
              filterCondition: $filterCondition
            ) {
              data {
                totalCount
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: {
        start: timeRange?.start?.toISOString(),
        end: timeRange?.end?.toISOString(),
      },
      filterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  const matchedCount =
    data.project?.spanCountTimeSeries?.data.reduce(
      (total, point) => total + (point.totalCount ?? 0),
      0
    ) ?? 0;
  const hasMatches = matchedCount > 0;
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-100);
        border-radius: var(--global-rounding-small);
        border: 1px solid var(--global-border-color-default);
      `}
    >
      <Text size="S" color={hasMatches ? "success" : "text-500"}>
        {hasMatches
          ? `${matchedCount.toLocaleString()} span${matchedCount === 1 ? "" : "s"} matched in the selected time range — newest shown in the preview panel`
          : "No spans match this scope in the selected time range"}
      </Text>
    </div>
  );
};

const AdvancedMappingDisclosure = () => {
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  const overrideCount = Object.keys(pathMapping).length;
  return (
    <Disclosure
      id="advanced"
      defaultExpanded={false}
      css={advancedMappingDisclosureCSS}
    >
      <DisclosureTrigger direction="column" alignItems="start" width="100%">
        <Heading level={2}>Advanced mapping</Heading>
        <Text color="text-500">
          {`input, output, and metadata bind automatically · ${
            overrideCount === 0
              ? "no overrides"
              : `${overrideCount} override${overrideCount === 1 ? "" : "s"}`
          }`}
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <Flex direction="column" gap="size-100">
          <Text color="text-500">
            Add only overrides that differ from the top-level span context.
          </Text>
          <EvaluatorInputMapping />
        </Flex>
      </DisclosurePanel>
    </Disclosure>
  );
};

/**
 * Renders the standalone disclosure as a bordered card matching the Scope and
 * Evaluator Annotation sections above it: the full card header is the click
 * target (a standalone disclosure trigger otherwise shrinks to fit its text),
 * hover feedback spans the whole width, and the mapping editor becomes the
 * card body instead of a nested bordered box.
 */
const advancedMappingDisclosureCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  .react-aria-Heading {
    width: 100%;
  }
  [slot="trigger"] {
    width: 100%;
    padding: var(--global-dimension-size-200);
    border-bottom: none;
    /* Keep the hover background inside the card's rounded corners without
       overflow: hidden, which would clip the editor's focus rings. */
    border-radius: calc(var(--global-rounding-medium) - 1px);
  }
  &[data-expanded="true"] [slot="trigger"] {
    border-bottom: 1px solid var(--global-border-color-default);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .disclosure__panel > * {
    padding: var(--global-dimension-size-200);
  }
`;
