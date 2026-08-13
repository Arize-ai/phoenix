import type { ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

type ProjectEvaluatorFormSectionsProps =
  | {
      definitionKind: "llm";
      /** The span filter autocompletes against this project's spans. */
      projectId: string;
      /** Target, sampling, and the span filter render below the name. */
      scope: ProjectEvaluatorScope;
      onScopeChange: (scope: ProjectEvaluatorScope) => void;
      onFilterValidityChange?: (isValid: boolean) => void;
      isTargetDisabled?: boolean;
    }
  | {
      definitionKind: "code" | "newCode";
      codeEvaluatorName?: string;
      /** Rendered in the definition section for an editable code evaluator. */
      codeDefinition?: ReactNode;
    };

/**
 * The left definition panel; the matching-span preview lives in
 * {@link ProjectEvaluatorScopePanel}.
 *
 * The LLM layout mirrors the dataset evaluator form: name and description,
 * then target, sampling, and the span filter, then the prompt with the
 * annotation config below it.
 */
export const ProjectEvaluatorFormSections = (
  props: ProjectEvaluatorFormSectionsProps
) => {
  if (props.definitionKind === "llm") {
    const {
      projectId,
      scope,
      onScopeChange,
      onFilterValidityChange,
      isTargetDisabled = false,
    } = props;
    return (
      <>
        <EvaluatorNameAndDescriptionFields />
        <View marginBottom="size-200" flex="none">
          <ProjectEvaluatorScopeFieldGroup
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={onFilterValidityChange}
            isTargetDisabled={isTargetDisabled}
            fillSampling
          />
        </View>
        <LLMEvaluatorForm showInputMapping={false} />
      </>
    );
  }
  const { codeEvaluatorName, codeDefinition } = props;
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
