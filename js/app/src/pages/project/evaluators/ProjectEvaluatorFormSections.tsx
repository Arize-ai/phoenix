import type { ReactNode } from "react";

import { Flex, Heading, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type {
  ProjectEvaluatorMappingSourceGrain,
  ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  formatEvaluationTargetPlural,
  toEvaluatorMappingSourceGrain,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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
 * test preview lives in {@link ProjectEvaluatorScopePanel}.
 *
 * The layout mirrors the dataset evaluator form: name and description, then
 * target, sampling, and the record filter, then the prompt with the annotation
 * config and the input mapping below it.
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

const ProjectEvaluatorInputMappingSection = ({
  grain,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
}) => {
  return (
    <Flex direction="column" gap="size-200" marginTop="size-200">
      <Flex direction="column" gap="size-100">
        <EvaluatorSectionHeader
          title="Evaluator Inputs"
          description={`Each input reads a path on the ${grain}.`}
        />
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
    </Flex>
  );
};

/**
 * The left definition panel for a code project evaluator, laid out the same
 * way as {@link ProjectLlmEvaluatorFormSections}: name and description, then
 * the scope, then the definition — either the code authoring fields and the
 * input mapping, or a summary of the existing evaluator being attached.
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
      <ProjectEvaluatorInputMappingSection
        grain={toEvaluatorMappingSourceGrain(scopeProps.scope.targetType)}
      />
    </>
  );
};
