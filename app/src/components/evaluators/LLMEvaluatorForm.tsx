import { useShallow } from "zustand/react/shallow";

import { Flex, Heading, Label, Switch, Text, View } from "@phoenix/components";
import { EvaluatorChatTemplate } from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorLLMChoice } from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";

export const LLMEvaluatorForm = () => {
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  if (evaluatorKind !== "LLM") {
    throw new Error("LLMEvaluatorForm called for non-LLM evaluator");
  }
  const { showPromptPreview, setShowPromptPreview } = useEvaluatorStore(
    useShallow((state) => ({
      showPromptPreview: state.showPromptPreview,
      setShowPromptPreview: state.setShowPromptPreview,
    }))
  );
  return (
    <>
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-100">
          <Flex justifyContent="space-between" alignItems="center">
            <Heading level={2} weight="heavy">
              Evaluator Prompt
            </Heading>
            <Flex direction="row" justifyContent="space-between" gap="size-100">
              <Switch
                isSelected={showPromptPreview}
                onChange={setShowPromptPreview}
                labelPlacement="start"
              >
                <Label>Preview</Label>
              </Switch>
              <TemplateFormatRadioGroup size="S" showNoneOption={false} />
            </Flex>
          </Flex>
          <Text color="text-500">
            Define or load a prompt for your evaluator.
          </Text>
        </Flex>
      </View>
      <Flex direction="column" gap="size-100">
        {showPromptPreview ? (
          <EvaluatorPromptPreview />
        ) : (
          <EvaluatorChatTemplate />
        )}
      </Flex>
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-100">
          <Heading level={2} weight="heavy">
            Evaluator Annotation
          </Heading>
          <Text color="text-500">
            Define the annotation that your evaluator will create.
          </Text>
          <EvaluatorLLMChoice />
        </Flex>
      </View>
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Map Prompt Variables (optional)
        </Heading>
        <Text color="text-500">
          Map the variables in your prompt to your dataset example and task
          output fields. You can leave these blank if your variable names match
          the field names.
        </Text>
        <View
          backgroundColor="dark"
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="dark"
        >
          <EvaluatorInputMapping />
        </View>
      </Flex>
    </>
  );
};
