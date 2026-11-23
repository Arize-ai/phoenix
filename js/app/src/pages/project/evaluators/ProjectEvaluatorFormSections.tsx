import type { ReactNode } from "react";
import { useId } from "react";

import {
  Card,
  Counter,
  Flex,
  Icon,
  Icons,
  Heading,
  Label,
  Switch,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import type {
  EvaluatorFormLayoutProps,
  EvaluatorFormSection,
} from "@phoenix/components/evaluators/EvaluatorFormLayout";
import { useExpandInputsWhen } from "@phoenix/components/evaluators/EvaluatorFormLayout";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import { useUnboundRequiredVariables } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import type {
  ProjectEvaluatorRecordKind,
  ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { toEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** Scope-editing props shared by every project evaluator form. */
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
 * The "Evaluator Scope" section of every project evaluator form's Scope tab:
 * target, sampling, and the record filter.
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
 * The "Advanced" card that ends every project evaluator form's Scope tab: settings that
 * change what an evaluation stores, not what it evaluates. It starts
 * collapsed, and its header says whether tracing is on, to sight and to
 * screen readers, so a closed card never hides that an evaluator has stopped
 * storing traces.
 */
export const ProjectEvaluatorAdvancedSection = ({
  scope,
  onScopeChange,
}: Pick<ProjectEvaluatorScopeProps, "scope" | "onScopeChange">) => {
  const tracingDescriptionId = useId();
  return (
    <View marginTop="size-200" marginBottom="size-200" flex="none">
      <Card
        title="Advanced"
        collapsible
        defaultOpen={false}
        // Plain text rather than a collapsed preview, which is hidden from
        // assistive tech: the state is short, and part of the toggle's name.
        headerContent={
          <Text size="S" color="text-700">
            {scope.tracingEnabled ? "Tracing on" : "Tracing off"}
          </Text>
        }
        testId="project-evaluator-advanced-card"
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-50">
            <Switch
              isSelected={scope.tracingEnabled}
              onChange={(tracingEnabled) =>
                onScopeChange({ ...scope, tracingEnabled })
              }
              aria-describedby={tracingDescriptionId}
            >
              <Label>Tracing</Label>
            </Switch>
            <Text id={tracingDescriptionId} size="S" color="text-500">
              {scope.tracingEnabled
                ? "Each evaluation stores a trace of its inputs, outputs, latency, and token cost, so you can analyze this evaluator's cost and performance and improve it."
                : "Evaluations store only their annotations. This saves storage, but this evaluator's cost, latency, and inputs are not recorded."}
            </Text>
          </Flex>
        </View>
      </Card>
    </View>
  );
};

/** The project scope props, plus what decides the form's mapping panel. */
type ProjectEvaluatorFormLayoutInput = ProjectEvaluatorScopeProps & {
  /** Which kind of evaluator, which names the stored panel sizes too. */
  evaluatorKind: ProjectEvaluatorKind;
  /** The name and description, or the attach summary. */
  identity: ReactNode;
  /** What the evaluator is; the Scope tab is added after them. */
  sections: EvaluatorFormSection[];
  /** Variables the evaluator requires; by default every declared one. */
  requiredVariables?: readonly string[];
  /** See {@link ProjectEvaluatorInputMapping}; defaults to true. */
  canDescribeInputs?: boolean;
  /** The records in scope, run through this evaluator. */
  tryIt: ReactNode;
};

type ProjectEvaluatorKind = "prompt" | "code" | "decision";

/**
 * A project evaluator form, as {@link EvaluatorFormLayout} lays it out: the
 * evaluator's own sections, then a Scope tab (target, sampling, the record
 * filter, and the advanced settings); the mapping from the evaluator's
 * variables to record paths docked under them; and the records in scope on
 * the right.
 */
export function makeProjectEvaluatorFormLayout({
  evaluatorKind,
  identity,
  sections,
  requiredVariables,
  canDescribeInputs,
  tryIt,
  ...scopeProps
}: ProjectEvaluatorFormLayoutInput): EvaluatorFormLayoutProps {
  const recordKind = toEvaluatorRecordKind(scopeProps.scope.targetType);
  return {
    layoutId: `project-${evaluatorKind}`,
    identity,
    sections: [
      ...sections,
      {
        id: "scope",
        title: "Scope",
        content: (
          <>
            <ProjectEvaluatorScopeSection {...scopeProps} />
            <ProjectEvaluatorAdvancedSection {...scopeProps} />
          </>
        ),
      },
    ],
    inputs: {
      title: evaluatorKind === "prompt" ? "Variables" : "Inputs",
      badge: (
        <ProjectEvaluatorInputsBadge requiredVariables={requiredVariables} />
      ),
      content: (
        <ProjectEvaluatorInputMappingBody
          recordKind={recordKind}
          requiredVariables={requiredVariables}
          evaluatorKind={evaluatorKind}
          canDescribeInputs={canDescribeInputs}
        />
      ),
    },
    tryIt,
  };
}

/**
 * How many variables there are to map, or, in red, how many have nothing to
 * read on the record and so block a save.
 */
const ProjectEvaluatorInputsBadge = ({
  requiredVariables,
}: {
  requiredVariables?: readonly string[];
}) => {
  const variables = useEvaluatorInputVariables();
  const unboundVariables = useUnboundRequiredVariables({
    variables,
    requiredVariables,
  });
  if (unboundVariables.length > 0) {
    return <Counter variant="danger" count={unboundVariables.length} />;
  }
  return variables.length > 0 ? (
    <Counter variant="quiet" count={variables.length} />
  ) : null;
};

/**
 * The mapping panel's content: a line on what the mapping does, then one
 * row per declared variable, or an empty state that says what the panel is
 * for when nothing is declared. A collapsed panel opens again on its own the
 * moment a variable has nothing to read.
 */
const ProjectEvaluatorInputMappingBody = ({
  recordKind,
  requiredVariables,
  evaluatorKind,
  canDescribeInputs,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  requiredVariables?: readonly string[];
  evaluatorKind: ProjectEvaluatorKind;
  canDescribeInputs?: boolean;
}) => {
  const variables = useEvaluatorInputVariables();
  const unboundVariables = useUnboundRequiredVariables({
    variables,
    requiredVariables,
  });
  useExpandInputsWhen(unboundVariables.length > 0);
  return (
    <>
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
                : evaluatorKind === "decision"
                  ? `Variables in the decision's state appear here, each mapped to the ${recordKind} data it reads.`
                  : `Parameters of the evaluator's function appear here, each mapped to the ${recordKind} data it reads.`
            }
          />
        }
      />
    </>
  );
};

/**
 * Stands in for the name and description when attaching an existing
 * evaluator, which has no name of its own to edit here.
 */
export const ProjectEvaluatorAttachSummary = ({
  evaluatorKind,
  evaluatorName,
  subtitle,
}: {
  evaluatorKind: "code" | "decision";
  evaluatorName?: string;
  subtitle?: string;
}) => {
  return (
    <Flex direction="column" gap="size-100">
      <EvaluatorSectionHeader
        title="Evaluator"
        description={`Attach the selected ${evaluatorKind} evaluator to this project.`}
      />
      <View
        borderRadius="medium"
        borderWidth="thin"
        borderColor="default"
        padding="size-200"
      >
        <Flex direction="column" gap="size-50">
          <Heading level={3}>{evaluatorName}</Heading>
          {subtitle ? (
            <Text size="S" color="text-500">
              {subtitle}
            </Text>
          ) : null}
        </Flex>
      </View>
    </Flex>
  );
};
