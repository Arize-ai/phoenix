import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  Counter,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Heading,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import { useUnboundRequiredVariables } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import type {
  ProjectEvaluatorRecordKind,
  ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** Scope-editing props shared by every left definition panel. */
type ProjectEvaluatorScopeProps = {
  /** The record filter autocompletes against this project's records. */
  projectId: string;
  /** Target, sampling, and the record filter render below the name. */
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  isTargetDisabled?: boolean;
};

/**
 * The "Evaluator Scope" section every project evaluator form renders under
 * the name and description: target, sampling, and the record filter.
 */
const ProjectEvaluatorScopeSection = ({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  isTargetDisabled = false,
}: ProjectEvaluatorScopeProps) => {
  return (
    <View marginBottom="size-200" flex="none">
      <Flex direction="column" gap="size-200">
        <EvaluatorSectionHeader
          title="Evaluator Scope"
          description={`Select which ${formatEvaluationTargetPlural(scope.targetType)} this evaluator runs on and how often.`}
        />
        <ProjectEvaluatorScopeFieldGroup
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={onFilterValidityChange}
          isTargetDisabled={isTargetDisabled}
        />
      </Flex>
    </View>
  );
};

/**
 * The left definition panel for an LLM project evaluator; the matching-record
 * test bench lives in {@link ProjectEvaluatorScopePanel} and the input
 * mapping in {@link ProjectEvaluatorInputMappingDock}, pinned under this.
 *
 * The layout mirrors the dataset evaluator form: name and description, then
 * target, sampling, and the record filter, then the prompt with the annotation
 * config.
 */
export const ProjectLlmEvaluatorFormSections = (
  scopeProps: ProjectEvaluatorScopeProps
) => {
  return (
    <>
      <EvaluatorNameAndDescriptionFields />
      <ProjectEvaluatorScopeSection {...scopeProps} />
      <LLMEvaluatorForm showInputMapping={false} />
    </>
  );
};

/**
 * Where each declared variable is read from on the record, docked to the
 * bottom of the left panel so it stays in view while the prompt or code above
 * it scrolls. Review found the section hard to discover at the end of the
 * scroll, and the mapping is what most often blocks a save.
 *
 * It starts open and only the author collapses it; a collapsed dock opens
 * again on its own the moment a variable has nothing to read. Open, it grows
 * with its rows up to half the panel and scrolls past that; it is not
 * dragged to a size. With no variables declared it says what the section is
 * for instead. It is drawn as an accordion item, the design system's pattern
 * for a section that collapses.
 */
export const ProjectEvaluatorInputMappingDock = ({
  recordKind,
  requiredVariables,
  evaluatorKind,
  canDescribeInputs,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  requiredVariables?: readonly string[];
  evaluatorKind: "prompt" | "code";
  /** See {@link ProjectEvaluatorInputMapping}; defaults to true. */
  canDescribeInputs?: boolean;
}) => {
  const variables = useEvaluatorInputVariables();
  const unboundVariables = useUnboundRequiredVariables({
    variables,
    requiredVariables,
  });
  const [isExpanded, setIsExpanded] = useState(true);
  // Reopen a dock the author closed when the first unbound variable appears,
  // and leave it alone until the count goes back to zero and climbs again.
  const previousUnboundCount = useRef(unboundVariables.length);
  useEffect(() => {
    if (previousUnboundCount.current === 0 && unboundVariables.length > 0) {
      setIsExpanded(true);
    }
    previousUnboundCount.current = unboundVariables.length;
  }, [unboundVariables.length]);
  const title =
    evaluatorKind === "prompt" ? "Map Prompt Variables" : "Input Mapping";
  return (
    <div css={mappingDockCSS} data-testid="project-evaluator-mapping-dock">
      {/* A one-item accordion, so the dock is drawn by the design system's
          own disclosure: its trigger bar, chevron, rule and hover. The group
          drops the rule a collapsed last item would draw against the footer. */}
      <DisclosureGroup
        expandedKeys={isExpanded ? [MAPPING_DOCK_KEY] : []}
        onExpandedChange={(keys) => setIsExpanded(keys.has(MAPPING_DOCK_KEY))}
      >
        <Disclosure id={MAPPING_DOCK_KEY}>
          <DisclosureTrigger arrowPosition="end">
            <Flex direction="row" alignItems="center" gap="size-100">
              {title}
              {unboundVariables.length > 0 ? (
                <Counter variant="danger">{unboundVariables.length}</Counter>
              ) : null}
            </Flex>
          </DisclosureTrigger>
          <DisclosurePanel>
            <div className="mapping-dock__body">
              {/* The trigger is a button, so the description lives here rather
                  than as a help popover inside it: a button cannot hold one.
                  With nothing to map, the empty state says it instead. */}
              {variables.length > 0 ? (
                <Text size="S" color="text-500">
                  {`Map evaluator variables to paths on the ${recordKind}. Unmapped input, output, and metadata read the ${recordKind} fields of the same name.`}
                </Text>
              ) : null}
              {/* Keyed so the rows rebuild against the new record kind rather than
                  carrying the previous one's paths forward. */}
              <ProjectEvaluatorInputMapping
                key={recordKind}
                recordKind={recordKind}
                requiredVariables={requiredVariables}
                canDescribeInputs={canDescribeInputs}
                emptyState={
                  <CompactEmptyState
                    icon={<Icon svg={<Icons.Plus />} />}
                    description={
                      evaluatorKind === "prompt"
                        ? `Variables in the prompt appear here, each mapped to the ${recordKind} data it reads.`
                        : `Parameters of the evaluator's function appear here, each mapped to the ${recordKind} data it reads.`
                    }
                  />
                }
              />
            </div>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </div>
  );
};

const MAPPING_DOCK_KEY = "mapping";

const mappingDockCSS = css`
  // The dock scrolls as a whole (see EvaluatorForm), so the trigger sticks
  // to its top while the rows pass under it. Scrolling one region rather
  // than the body alone keeps a single scrollbar gutter, the same width as
  // the form's, beside both the trigger and the rows.
  .disclosure__trigger {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--global-background-color-default);
  }
  .mapping-dock__body {
    display: flex;
    flex-direction: column;
    // Description to fields, as in the sections above.
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-200);
  }
`;

/**
 * The left definition panel for a code project evaluator. When authoring code
 * (`codeDefinition` given) it is laid out the same way as
 * {@link ProjectLlmEvaluatorFormSections}: name and description, then the
 * scope, then the code authoring fields. When attaching an existing evaluator
 * there is no name to edit, so a summary card of that evaluator stands in for
 * the name, and the scope follows it. The input mapping is docked under
 * either layout by {@link ProjectEvaluatorInputMappingDock}.
 */
export const ProjectCodeEvaluatorFormSections = ({
  codeEvaluatorName,
  codeDefinition,
  onFieldChange,
  ...scopeProps
}: ProjectEvaluatorScopeProps & {
  codeEvaluatorName?: string;
  /** Rendered as the definition section for an editable code evaluator. */
  codeDefinition?: ReactNode;
  /** Fires when the name or description changes. */
  onFieldChange?: () => void;
}) => {
  if (codeDefinition == null) {
    return (
      <>
        <View marginBottom="size-200" flex="none">
          <Flex direction="column" gap="size-100">
            <EvaluatorSectionHeader
              title="Evaluator"
              description="Attach the selected code evaluator to this project."
            />
            <View
              borderRadius="medium"
              borderWidth="thin"
              borderColor="default"
              padding="size-200"
            >
              <Heading level={3}>{codeEvaluatorName}</Heading>
            </View>
          </Flex>
        </View>
        <ProjectEvaluatorScopeSection {...scopeProps} />
      </>
    );
  }
  return (
    <>
      <EvaluatorNameAndDescriptionFields
        onValueChange={onFieldChange}
        isNameRequired
        descriptionPlaceholder="e.g. code evaluator description"
      />
      <ProjectEvaluatorScopeSection {...scopeProps} />
      {codeDefinition}
    </>
  );
};
