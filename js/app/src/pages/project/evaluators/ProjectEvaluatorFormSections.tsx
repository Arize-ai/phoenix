import { memo, type ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { BOUND_VARIABLES_PLACEMENT } from "@phoenix/pages/project/evaluators/boundVariablesPlacement";
import { ProjectEvaluatorBoundVariables } from "@phoenix/pages/project/evaluators/ProjectEvaluatorBoundVariables";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type {
  ProjectEvaluatorMappingSourceGrain,
  ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { toEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** Scope-editing props shared by every left definition panel. */
type ProjectEvaluatorScopeProps = {
  /** The span filter autocompletes against this project's spans. */
  projectId: string;
  /** Target, sampling, and the span filter render below the name. */
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  isTargetDisabled?: boolean;
};

/**
 * The "Evaluator Scope" section every project evaluator form renders under
 * the name and description: target, sampling, and the record filter.
 */
const ProjectEvaluatorScopeSection = memo(
  function ProjectEvaluatorScopeSection({
    projectId,
    scope,
    onScopeChange,
    onFilterValidityChange,
    isTargetDisabled,
  }: ProjectEvaluatorScopeProps) {
    return (
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-200">
          <EvaluatorSectionHeader
            title="Evaluator Scope"
            description={
              scope.targetType === "SESSION"
                ? "Select which sessions this evaluator runs on and how often."
                : "Select which spans this evaluator runs on and how often."
            }
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
  }
);

/**
 * The left definition panel for an LLM project evaluator; the matching-record
 * test preview lives in {@link ProjectEvaluatorScopePanel}.
 *
 * The layout mirrors the dataset evaluator form: name and description, then
 * target, sampling, and the span filter, then the prompt with the annotation
 * config below it.
 */
export const ProjectLlmEvaluatorFormSections = (
  scopeProps: ProjectEvaluatorScopeProps
) => {
  return (
    <>
      <EvaluatorNameAndDescriptionFields />
      <ProjectEvaluatorScopeSection {...scopeProps} />
      <LLMEvaluatorForm
        inputMappingSection={
          <ProjectEvaluatorInputMappingSection
            grain={toEvaluatorMappingSourceGrain(scopeProps.scope.targetType)}
          />
        }
      />
    </>
  );
};

/**
 * The three inputs an evaluator receives, and — where the experiment currently
 * places it — the list of values its record supplies by name.
 */
const ProjectEvaluatorInputMappingSection = ({
  grain,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
}) => {
  const recordNoun = grain === "session" ? "session" : "span";
  return (
    <Flex direction="column" gap="size-200" marginTop="size-200">
      <Flex direction="column" gap="size-100">
        <Flex direction="column" gap="size-25">
          <Heading level={2} weight="heavy">
            Evaluator Inputs
          </Heading>
          <Text color="text-500" size="S">
            Every evaluator receives an input, an output, and metadata. Leave a
            row alone to use what the {recordNoun} already provides, or point it
            at any field of the {recordNoun}.
          </Text>
        </Flex>
        <View
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="default"
        >
          {/* Keyed so the rows rebuild against the new record kind rather than
              carrying the previous one's paths forward. */}
          <ProjectEvaluatorInputMapping key={grain} grain={grain} />
        </View>
      </Flex>
      {BOUND_VARIABLES_PLACEMENT === "mapping-section" ? (
        <View
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          borderColor="default"
        >
          <ProjectEvaluatorBoundVariables grain={grain} />
        </View>
      ) : null}
    </Flex>
  );
};

/**
 * The left definition panel for a code project evaluator, laid out the same
 * way as {@link ProjectLlmEvaluatorFormSections}: name and description, then
 * the scope, then the definition — either the code authoring fields, or a
 * summary of the existing evaluator being attached.
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
  return (
    <>
      {codeDefinition ? (
        <EvaluatorNameAndDescriptionFields onValueChange={onFieldChange} />
      ) : (
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
      )}
      <ProjectEvaluatorScopeSection {...scopeProps} />
      {codeDefinition}
    </>
  );
};
