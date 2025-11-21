import { PropsWithChildren, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

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
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import {
  ChoiceConfig,
  EvaluatorLLMChoice,
} from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    description: string;
  };
  choiceConfig: ChoiceConfig;
  dataset?: {
    readonly: boolean;
    id: string;
    assignEvaluatorToDataset: boolean;
  };
  inputMapping: Record<string, string>;
};

const DEFAULT_FORM_VALUES: EvaluatorFormValues = {
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
  inputMapping: {},
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
    defaultValues: { ...DEFAULT_FORM_VALUES, ...defaultValues },
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
  const { control, getValues, watch, setValue } =
    useFormContext<EvaluatorFormValues>();
  const { variableKeys: variables } = useDerivedPlaygroundVariables();
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );
  const [evaluatorInputObject, setEvaluatorInputObject] =
    useState<EvaluatorInput | null>(null);
  const selectedDatasetId = watch("dataset.id");
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={65} css={panelCSS} style={panelStyle}>
        <PanelContainer>
          <Flex
            direction="row"
            alignItems="baseline"
            width="100%"
            gap="size-100"
          >
            <Controller
              name="evaluator.name"
              control={control}
              rules={{
                validate: validateIdentifier,
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  autoComplete="off"
                  isInvalid={!!error}
                  autoFocus
                >
                  <Label>Name</Label>
                  <Input placeholder="e.g. correctness_evaluator" />
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
                  <Input placeholder="e.g. rate the response on correctness" />
                  <FieldError>{error?.message}</FieldError>
                </TextField>
              )}
            />
          </Flex>
          <Flex direction="column" gap="size-100">
            <Heading level={3}>Prompt</Heading>
            <Text color="text-500">
              Define or load a prompt for your evaluator.
            </Text>
            <EvaluatorChatTemplate />
          </Flex>
          <Flex direction="column" gap="size-100">
            <Heading level={3}>Evaluator Annotation</Heading>
            <Text color="text-500">
              Define the annotation that your evaluator will return.
            </Text>
            <EvaluatorLLMChoice control={control} />
          </Flex>
        </PanelContainer>
      </Panel>
      <PanelResizeHandle disabled />
      <Panel defaultSize={35} css={panelCSS} style={panelStyle}>
        <PanelContainer>
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-static-size-200);
              background-color: var(--ac-global-background-color-dark);
              border-radius: var(--ac-global-rounding-medium);
              padding: var(--ac-global-dimension-static-size-200);
              border: 1px solid var(--ac-global-border-color-default);
            `}
          >
            <EvaluatorExampleDataset
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={(datasetId) => {
                if (datasetId) {
                  setValue("dataset.id", datasetId);
                } else {
                  setValue("dataset", undefined);
                }
              }}
              selectedSplitIds={selectedSplitIds}
              onSelectSplits={setSelectedSplitIds}
              selectedExampleId={selectedExampleId}
              onSelectExampleId={setSelectedExampleId}
              datasetSelectIsDisabled={!!getValues().dataset?.readonly}
              onEvaluatorInputObjectChange={setEvaluatorInputObject}
            />
            <EvaluatorInputMapping
              evaluatorInput={evaluatorInputObject}
              exampleId={selectedExampleId ?? undefined}
              control={control}
              variables={variables}
            />
            <Flex direction="column" gap="size-100">
              <Heading level={3}>Test your evaluator</Heading>
              <Text color="text-500">
                Give your evaluator a test run against the selected dataset
                example, and a hypothetical task output.
              </Text>
            </Flex>
          </div>
        </PanelContainer>
      </Panel>
    </PanelGroup>
  );
};

const PanelContainer = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-200);
        padding: var(--ac-global-dimension-size-100) 0;
      `}
    >
      {children}
    </div>
  );
};

const panelCSS = css`
  padding: 0 var(--ac-global-dimension-size-200);
`;

const panelStyle = {
  height: "100%",
  overflowY: "auto",
} as const;
