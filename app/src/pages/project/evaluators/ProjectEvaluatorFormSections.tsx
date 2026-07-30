import type { ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";

/**
 * The left-panel definition flow for a project evaluator: what the judge
 * reads and does — name/description and the prompt (or code) definition.
 * Scope and the annotation template live in the right-panel
 * {@link ProjectEvaluatorScopePanel}. Input bindings stay zero-config —
 * `input`, `output`, and `metadata` bind automatically from the span
 * evaluation context, previewed per span in the scope panel's Bindings tab.
 */
export const ProjectEvaluatorFormSections = ({
  definitionKind,
  codeEvaluatorName,
  codeDefinition,
}: {
  definitionKind: "llm" | "code" | "newCode";
  codeEvaluatorName?: string;
  /** Authoring fields rendered in the definition section when `newCode`. */
  codeDefinition?: ReactNode;
}) => {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-200" flex="none">
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Evaluator</Heading>
          <Text color="text-500" size="S">
            {definitionKind === "llm"
              ? "Define the evaluator that will run on matched spans."
              : definitionKind === "newCode"
                ? "Define your evaluator's source code and annotation output."
                : "Attach the selected code evaluator to this project."}
          </Text>
        </Flex>
        {definitionKind === "llm" ? (
          <Flex direction="column" gap="size-200">
            <EvaluatorNameAndDescriptionFields />
            <LLMEvaluatorForm
              showInputMapping={false}
              showAnnotationConfig={false}
            />
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
    </Flex>
  );
};
