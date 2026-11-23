import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Flex, Label, Switch, View } from "@phoenix/components";
import { EvaluatorCategoricalChoiceConfig } from "@phoenix/components/evaluators/EvaluatorCategoricalChoiceConfig";
import { EvaluatorChatTemplate } from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import type { EvaluatorFormSection } from "@phoenix/components/evaluators/EvaluatorFormLayout";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { TemplateFormatRadioGroup } from "@phoenix/components/playground/TemplateFormatRadioGroup";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

/**
 * The prompt and the annotation it produces. Evaluator forms show them in
 * tabs of their own (see {@link makeLLMEvaluatorSections}), so either can be
 * left out.
 */
export const LLMEvaluatorForm = ({
  showPrompt = true,
  showAnnotationConfig = true,
}: {
  showPrompt?: boolean;
  showAnnotationConfig?: boolean;
}) => {
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  if (evaluatorKind !== "LLM") {
    throw new Error("LLMEvaluatorForm called for non-LLM evaluator");
  }
  const { showPromptPreview, setShowPromptPreview, outputConfig } =
    useEvaluatorStore(
      useShallow((state) => ({
        showPromptPreview: state.showPromptPreview,
        setShowPromptPreview: state.setShowPromptPreview,
        outputConfig: state.outputConfigs[0],
      }))
    );
  const isCategoricalAnnotationConfig = useMemo(() => {
    return outputConfig && "values" in outputConfig;
  }, [outputConfig]);
  return (
    <>
      {showPrompt ? (
        <>
          <View marginBottom="size-200" flex="none">
            <EvaluatorSectionHeader
              title="Evaluator Prompt"
              description="Write the prompt your evaluator sends to the LLM."
              extra={
                <Flex direction="row" alignItems="center" gap="size-100">
                  <Switch
                    isSelected={showPromptPreview}
                    onChange={setShowPromptPreview}
                    labelPlacement="start"
                  >
                    <Label>Preview</Label>
                  </Switch>
                  <TemplateFormatRadioGroup size="S" showNoneOption={false} />
                </Flex>
              }
            />
          </View>
          <Flex direction="column" gap="size-100">
            {showPromptPreview ? (
              <EvaluatorPromptPreview />
            ) : (
              <EvaluatorChatTemplate />
            )}
          </Flex>
        </>
      ) : null}
      {showAnnotationConfig ? (
        <View marginBottom="size-200" flex="none">
          <Flex direction="column" gap="size-100">
            <EvaluatorSectionHeader
              title="Evaluator Annotation"
              description="Define the annotation that your evaluator will create."
            />
            {isCategoricalAnnotationConfig ? (
              <EvaluatorCategoricalChoiceConfig />
            ) : null}
          </Flex>
        </View>
      ) : null}
    </>
  );
};

/** An LLM evaluator's definition, as the tabs of an evaluator form. */
export function makeLLMEvaluatorSections(): EvaluatorFormSection[] {
  return [
    {
      id: "prompt",
      title: "Prompt",
      content: <LLMEvaluatorForm showAnnotationConfig={false} />,
    },
    {
      id: "annotation",
      title: "Annotation",
      content: <LLMEvaluatorForm showPrompt={false} />,
    },
  ];
}
