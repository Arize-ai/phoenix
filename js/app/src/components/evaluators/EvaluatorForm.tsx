import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import type { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/components/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";
import type {
  ClassificationEvaluatorAnnotationConfig,
  EvaluatorInputMapping as EvaluatorInputMappingType,
  EvaluatorKind,
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
  outputConfigs?: ClassificationEvaluatorAnnotationConfig[];
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
