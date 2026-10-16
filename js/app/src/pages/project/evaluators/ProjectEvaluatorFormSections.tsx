import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  Counter,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  Text,
  View,
} from "@phoenix/components";
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
 * The dock's job is to surface a problem. It opens on its own the moment a
 * variable has nothing to read, and otherwise starts collapsed to one row so
 * two correctly defaulted fields do not cost the prompt editor a third of
 * the pane. Open, it grows with its rows up to half the panel and scrolls
 * past that; it is not dragged to a size. Its header is set like the section
 * headings above it rather than as a bar of its own, so the dock reads as
 * the form's last section that happens to stay put.
 */
export const ProjectEvaluatorInputMappingDock = ({
  recordKind,
  requiredVariables,
  evaluatorKind,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  requiredVariables?: readonly string[];
  evaluatorKind: "prompt" | "code";
}) => {
  const variables = useEvaluatorInputVariables();
  const unboundVariables = useUnboundRequiredVariables({
    variables,
    requiredVariables,
  });
  const [isExpanded, setIsExpanded] = useState(unboundVariables.length > 0);
  // Expand when the first unbound variable appears, and leave a dock the
  // author closed alone until the count goes back to zero and climbs again.
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
      <Disclosure
        isExpanded={isExpanded}
        onExpandedChange={setIsExpanded}
        size="S"
      >
        {/* The chevron trails the title so the title starts on the same
            left edge as the section headings above, and the body under it. */}
        <DisclosureTrigger arrowPosition="end">
          <Flex direction="row" alignItems="center" gap="size-100">
            <span className="mapping-dock__title">{title}</span>
            {unboundVariables.length > 0 ? (
              <Counter variant="danger">{unboundVariables.length}</Counter>
            ) : null}
          </Flex>
        </DisclosureTrigger>
        <DisclosurePanel>
          <div className="mapping-dock__body">
            {/* The trigger is a button, so the description lives here rather
                than as a help popover inside it: a button cannot hold one. */}
            <Text size="S" color="text-500">
              {`Map evaluator variables to paths on the ${recordKind}. Unmapped input, output, and metadata read the ${recordKind} fields of the same name.`}
            </Text>
            {/* Keyed so the rows rebuild against the new record kind rather than
                carrying the previous one's paths forward. */}
            <ProjectEvaluatorInputMapping
              key={recordKind}
              recordKind={recordKind}
              requiredVariables={requiredVariables}
            />
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  );
};

const mappingDockCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 0;
  // Every box between the dock and its scrolling body has to be allowed to
  // shrink, or the panel's cap on the dock's height never reaches the body.
  .disclosure,
  .disclosure__panel:not([hidden]) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  // The dock is a section of the form like the ones above it, so its title
  // takes the same level-2 heading scale rather than the disclosure default.
  .mapping-dock__title {
    font-size: var(--global-font-size-l);
    line-height: var(--global-line-height-l);
    font-weight: 600;
  }
  // A section heading, not a bar: no rule under it and no tint on hover.
  // The chevron is the only sign that it toggles. The heading class is part
  // of the selector because the Disclosure's own trigger rule has the same
  // specificity as a bare attribute selector here and is inserted later.
  .disclosure__trigger [slot="trigger"] {
    border-bottom: none;
    // The same rhythm as the sections above: a section's worth of space
    // over the title, and the heading-to-description gap under it.
    padding: var(--global-dimension-size-200) var(--global-dimension-size-200)
      var(--global-dimension-size-25);
    &:hover:not([disabled]) {
      background-color: transparent;
    }
  }
  // Collapsed there is no description to sit close to, so the title is
  // centered in its band rather than pressed against the footer.
  .disclosure:not([data-expanded="true"])
    .disclosure__trigger
    [slot="trigger"] {
    padding-bottom: var(--global-dimension-size-200);
  }
  .mapping-dock__body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    // Description to fields, as in the sections above.
    gap: var(--global-dimension-size-200);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);
    box-sizing: border-box;
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
