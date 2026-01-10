import { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import { Flex, View } from "@phoenix/components";
import { CodeEvaluatorForm } from "@phoenix/components/evaluators/CodeEvaluatorForm";
import { EvaluatorDescriptionInput } from "@phoenix/components/evaluators/EvaluatorDescriptionInput";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { EvaluatorNameInput } from "@phoenix/components/evaluators/EvaluatorNameInput";
import { EvaluatorOutputPreview } from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import {
  DEFAULT_STORE_VALUES,
  type EvaluatorStore,
} from "@phoenix/store/evaluatorStore";
import {
  ClassificationEvaluatorAnnotationConfig,
  type EvaluatorInputMapping as EvaluatorInputMappingType,
  type EvaluatorKind,
} from "@phoenix/types";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    kind: EvaluatorKind;
    description: string;
    isBuiltin?: boolean | null;
    builtInEvaluatorName?: string | null;
    includeExplanation?: boolean;
  };
  outputConfig?: ClassificationEvaluatorAnnotationConfig;
  // TODO: this makes very little sense in react hook form state, but will make more sense when we move to zustand
  dataset?: {
    readonly: boolean;
    id: string;
  };
  inputMapping: EvaluatorInputMappingType;
};

/**
 * Create a react-hook-form instance for all non-chat-template values the evaluator form.
 * @param defaultValues - The default values for the form. Useful for editing an existing evaluator.
 * @returns A react-hook-form instance for the evaluator form.
 */
export const useEvaluatorForm = (
  defaultValues?: Partial<EvaluatorFormValues>
) => {
  const form = useForm<EvaluatorFormValues>({
    defaultValues: { ...DEFAULT_STORE_VALUES, ...defaultValues },
    mode: "onChange",
  });

  return form;
};

export type EvaluatorFormController = ReturnType<typeof useEvaluatorForm>;

/**
 * Provide the given react-hook-form instance for the evaluator form and new
 * default playground state for the evaluator chat template.
 *
 * @param props.children - The children to render.
 * @param props.form - The react-hook-form instance for the evaluator form.
 */
export const EvaluatorFormProvider = ({
  children,
  form,
  promptId,
  promptName,
  promptVersionRef,
  promptVersionTag,
}: PropsWithChildren<{
  form: EvaluatorFormController;
  promptId?: string;
  promptName?: string;
  promptVersionRef?: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key;
  promptVersionTag?: string;
}>) => {
  return (
    <EvaluatorPlaygroundProvider
      promptId={promptId}
      promptName={promptName}
      promptVersionRef={promptVersionRef}
      promptVersionTag={promptVersionTag}
    >
      <FormProvider {...form}>{children}</FormProvider>
    </EvaluatorPlaygroundProvider>
  );
};

const evaluatorFormSelector = (state: EvaluatorStore) => ({
  evaluatorKind: state.evaluator.kind,
  isBuiltin: state.evaluator.isBuiltin,
});

/**
 * A form for configuring evaluators.
 * Depends on the EvaluatorFormProvider to provide the react-hook-form instance for the evaluator form and new
 * default playground state for the evaluator chat template.
 *
 * @example
 * ```tsx
 * const form = useEvaluatorForm();
 * return (
 *   <EvaluatorFormProvider form={form}>
 *     <EvaluatorForm />
 *   </EvaluatorFormProvider>
 * );
 * ```
 */
export const EvaluatorForm = () => {
  const { evaluatorKind } = useEvaluatorStore(
    useShallow(evaluatorFormSelector)
  );
  return (
    <PanelGroup direction="horizontal">
      <Panel
        defaultSize={65}
        style={panelStyle}
        css={css`
          display: flex;
          flex-direction: column;
          padding: var(--ac-global-dimension-size-100)
            var(--ac-global-dimension-size-200);
          box-sizing: border-box;
        `}
      >
        <View marginBottom="size-200" flex="none">
          <Flex
            direction="row"
            alignItems="baseline"
            width="100%"
            gap="size-100"
          >
            <EvaluatorNameInput />
            <EvaluatorDescriptionInput />
          </Flex>
        </View>
        {evaluatorKind === "LLM" && <LLMEvaluatorForm />}
        {evaluatorKind === "CODE" && <CodeEvaluatorForm />}
      </Panel>
      <PanelResizeHandle css={compactResizeHandleCSS} />
      <Panel
        defaultSize={35}
        style={panelStyle}
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-size-200);
          padding: var(--ac-global-dimension-size-100) 0;
          box-sizing: border-box;
        `}
      >
        <Flex direction="column" gap="size-200">
          <View paddingX="size-200">
            <Flex direction="column" gap="size-100">
              <EvaluatorOutputPreview />
              <EvaluatorExampleDataset />
            </Flex>
          </View>
          <EvaluatorInputPreview />
        </Flex>
      </Panel>
    </PanelGroup>
  );
};

const panelStyle = {
  height: "100%",
  overflowY: "auto",
} as const;
