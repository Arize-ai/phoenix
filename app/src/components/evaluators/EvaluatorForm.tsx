import React, { PropsWithChildren } from "react";
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
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    description: string;
  };
  choiceConfig: ChoiceConfig;
};

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

export const EvaluatorFormProvider = ({
  children,
  form,
}: PropsWithChildren<{ form: EvaluatorFormController }>) => {
  return (
    <EvaluatorChatTemplateProvider>
      <FormProvider {...form}>{children}</FormProvider>
    </EvaluatorChatTemplateProvider>
  );
};

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
        <EvaluatorChatTemplate />
      </Flex>
    </>
  );
};
