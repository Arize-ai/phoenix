import type { ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The left definition panel for an LLM project evaluator; the matching-span
 * preview lives in {@link ProjectEvaluatorScopePanel}.
 *
 * The layout mirrors the dataset evaluator form: name and description, then
 * target, sampling, and the span filter, then the prompt with the annotation
 * config below it.
 */
export const ProjectLlmEvaluatorFormSections = ({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  isTargetDisabled = false,
}: {
  /** The span filter autocompletes against this project's spans. */
  projectId: string;
  /** Target, sampling, and the span filter render below the name. */
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  isTargetDisabled?: boolean;
}) => {
  return (
    <>
      <EvaluatorNameAndDescriptionFields />
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-200">
          <Flex direction="column" gap="size-25">
            <Heading level={2} weight="heavy">
              Evaluator Scope
            </Heading>
            <Text color="text-500" size="S">
              {scope.targetType === "SESSION"
                ? "Select which sessions this evaluator runs on and how often."
                : "Select which spans this evaluator runs on and how often."}
            </Text>
          </Flex>
          <ProjectEvaluatorScopeFieldGroup
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={onFilterValidityChange}
            isTargetDisabled={isTargetDisabled}
            fillSampling
          />
        </Flex>
      </View>
      <LLMEvaluatorForm showInputMapping={false} />
    </>
  );
};

/**
 * The left definition panel for a code project evaluator: either the code
 * authoring fields, or a summary of the existing evaluator being attached.
 */
export const ProjectCodeEvaluatorFormSections = ({
  codeEvaluatorName,
  codeDefinition,
}: {
  codeEvaluatorName?: string;
  /** Rendered in the definition section for an editable code evaluator. */
  codeDefinition?: ReactNode;
}) => {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-200" flex="none">
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Evaluator</Heading>
          <Text color="text-500" size="S">
            {codeDefinition
              ? "Define your evaluator's source code and annotation output."
              : "Attach the selected code evaluator to this project."}
          </Text>
        </Flex>
        {codeDefinition ?? (
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
    </Flex>
  );
};
