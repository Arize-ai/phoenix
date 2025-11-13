import { PropsWithChildren } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form";

import {
  FieldError,
  Flex,
  Heading,
  Input,
  Label,
  Text,
  TextField,
} from "@phoenix/components";
import {
  EvaluatorChatTemplate,
  EvaluatorChatTemplateProvider,
} from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import {
  ChoiceConfig,
  EvaluatorLLMChoice,
} from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    description: string;
  };
  choiceConfig: ChoiceConfig;
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
    defaultValues: defaultValues || {
      evaluator: {
        name: "",
        description: "",
      },
      choiceConfig: {
        name: "",
        choices: [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      },
    },
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
    <EvaluatorChatTemplateProvider
      promptId={promptId}
      promptName={promptName}
      promptVersionRef={promptVersionRef}
      promptVersionTag={promptVersionTag}
    >
      <FormProvider {...form}>{children}</FormProvider>
    </EvaluatorChatTemplateProvider>
  );
};

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
  const { control } = useFormContext<EvaluatorFormValues>();
  return (
    <>
      <Flex direction="row" alignItems="baseline" width="100%" gap="size-100">
        <Controller
          name="evaluator.name"
          control={control}
          rules={{
            validate: validateIdentifier,
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField {...field} autoComplete="off" isInvalid={!!error}>
              <Label>Name</Label>
              <Input placeholder="e.g. correctness_evaluator" autoFocus />
              <FieldError>{error?.message}</FieldError>
            </TextField>
          )}
        />
        <Controller
          name="evaluator.description"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField {...field} autoComplete="off" isInvalid={!!error}>
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. rate the response on correctness"
                autoFocus
              />
              <FieldError>{error?.message}</FieldError>
            </TextField>
          )}
        />
      </Flex>
      <Flex direction="column" gap="size-100">
        <Heading level={3}>Eval</Heading>
        <Text color="text-500">
          Define the eval annotation returned by your evaluator.
        </Text>
        <EvaluatorLLMChoice control={control} />
      </Flex>
      <Flex direction="column" gap="size-100">
        <Heading level={3}>Prompt</Heading>
        <Text color="text-500">
          Define or load a prompt for your evaluator.
        </Text>
        <EvaluatorChatTemplate />
      </Flex>
    </>
  );
};
