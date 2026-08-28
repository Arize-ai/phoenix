import { memo, type ReactNode } from "react";

import { Flex, Heading, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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
      <LLMEvaluatorForm showInputMapping={false} />
    </>
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
