import { useFormContext } from "react-hook-form";

import { Flex, Heading, Label, Switch, Text } from "@phoenix/components";
import { EvaluatorChatTemplate } from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import type { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorLLMChoice } from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import type { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";

/**
 * TODO: move all of these into zustand
 */
type LLMEvaluatorFormProps = {
  showPromptPreview: boolean;
  setShowPromptPreview: (showPromptPreview: boolean) => void;
  evaluatorInputObject: EvaluatorInput | null;
};

export const LLMEvaluatorForm = ({
  showPromptPreview,
  setShowPromptPreview,
  evaluatorInputObject,
}: LLMEvaluatorFormProps) => {
  const { watch } = useFormContext<EvaluatorFormValues>();
  const evaluatorKind = watch("evaluator.kind");
  if (evaluatorKind !== "LLM") {
    throw new Error("LLMEvaluatorForm called for non-LLM evaluator");
  }
  return (
    <>
      <Flex direction="column" gap="size-100">
        <Heading level={3}>Prompt</Heading>
        <Text color="text-500">
          Define or load a prompt for your evaluator.
        </Text>
        <Flex direction="row" justifyContent="space-between">
          <TemplateFormatRadioGroup size="S" showNoneOption={false} />
          <Switch
            isSelected={showPromptPreview}
            onChange={setShowPromptPreview}
            labelPlacement="start"
          >
            <Label>Preview</Label>
          </Switch>
        </Flex>
      </Flex>
      <Flex direction="column" gap="size-100">
        {showPromptPreview ? (
          <EvaluatorPromptPreview evaluatorInput={evaluatorInputObject} />
        ) : (
          <EvaluatorChatTemplate />
        )}
      </Flex>
      <Flex direction="column" gap="size-100">
        <Heading level={3}>Evaluator Annotation</Heading>
        <Text color="text-500">
          Define the annotation that your evaluator will return.
        </Text>
        <EvaluatorLLMChoice />
      </Flex>
    </>
  );
};
