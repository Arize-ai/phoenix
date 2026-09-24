import type { ReactNode } from "react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Flex, Label, Switch, View } from "@phoenix/components";
import { EvaluatorCategoricalChoiceConfig } from "@phoenix/components/evaluators/EvaluatorCategoricalChoiceConfig";
import { EvaluatorChatTemplate } from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";

export const LLMEvaluatorForm = ({
  showInputMapping = true,
  showAnnotationConfig = true,
  inputMappingSection,
}: {
  showInputMapping?: boolean;
  showAnnotationConfig?: boolean;
  /**
   * Replaces the dataset mapping section. A dataset evaluator maps one row per
   * template variable; an evaluator on a project's records maps the three
   * inputs it receives, so the two sections are not the same control.
   */
  inputMappingSection?: ReactNode;
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
      {inputMappingSection}
      {inputMappingSection == null && showInputMapping ? (
        <Flex direction="column" gap="size-100">
          <EvaluatorSectionHeader
            title="Map Prompt Variables (optional)"
            description="Variables left blank are matched to fields of the same name."
          />
          <View
            borderRadius="medium"
            borderWidth="thin"
            padding="size-200"
            marginTop="size-50"
            borderColor="default"
          >
            <EvaluatorInputMapping />
          </View>
        </Flex>
      ) : null}
    </>
  );
};
