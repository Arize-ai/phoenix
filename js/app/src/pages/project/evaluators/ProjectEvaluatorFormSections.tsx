import type { ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type {
  ProjectEvaluatorMappingSourceGrain,
  ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { toEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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
          <Heading level={2} weight="heavy">
            Evaluator Scope
          </Heading>
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
      <LLMEvaluatorForm
        inputMappingSection={
          <ProjectEvaluatorInputMappingSection
            grain={toEvaluatorMappingSourceGrain(scope.targetType)}
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
            Every evaluator receives an input, an output, and metadata, and each
            can be pointed at any field of the {recordNoun}.
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
    </Flex>
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
          {codeDefinition ? null : (
            <Text color="text-500" size="S">
              Attach the selected code evaluator to this project.
            </Text>
          )}
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
