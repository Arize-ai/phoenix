import { PropsWithChildren, useState } from "react";
import {
  Controller,
  type DeepPartial,
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
import { CodeEvaluatorForm } from "@phoenix/components/evaluators/CodeEvaluatorForm";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import {
  ClassificationEvaluatorAnnotationConfig,
  type EvaluatorInputMapping as EvaluatorInputMappingType,
  type EvaluatorKind,
} from "@phoenix/types";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    kind: EvaluatorKind;
    description: string;
    isBuiltin?: boolean | null;
    builtInEvaluatorName?: string | null;
  };
  outputConfig?: ClassificationEvaluatorAnnotationConfig;
  // TODO: this makes very little sense in react hook form state, but will make more sense when we move to zustand
  dataset?: {
    readonly: boolean;
    id: string;
    assignEvaluatorToDataset: boolean;
  };
  inputMapping: EvaluatorInputMappingType;
};

/**
 * Common default values for all evaluator kinds.
 */
export const DEFAULT_FORM_VALUES = {
  evaluator: {
    name: "",
    description: "",
  },
  inputMapping: {
    literalMapping: {},
    pathMapping: {},
  },
} satisfies DeepPartial<EvaluatorFormValues>;

/**
 * Default values for LLM evaluators.
 */
export const DEFAULT_LLM_FORM_VALUES: EvaluatorFormValues = {
  ...DEFAULT_FORM_VALUES,
  evaluator: {
    ...DEFAULT_FORM_VALUES.evaluator,
    kind: "LLM",
  },
  outputConfig: {
    name: "",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "", score: undefined },
      { label: "", score: undefined },
    ],
    includeExplanation: true,
  },
};

/**
 * Default values for CODE evaluators.
 */
export const DEFAULT_CODE_FORM_VALUES: EvaluatorFormValues = {
  ...DEFAULT_FORM_VALUES,
  evaluator: {
    ...DEFAULT_FORM_VALUES.evaluator,
    kind: "CODE",
  },
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
  // TODO: move all of these useStates into zustand
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );
  const [evaluatorInputObject, setEvaluatorInputObject] =
    useState<EvaluatorInput | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const selectedDatasetId = watch("dataset.id");
  const evaluatorKind = watch("evaluator.kind");
  const isBuiltin = watch("evaluator.isBuiltin");
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
                <TextField
                  {...field}
                  autoComplete="off"
                  isInvalid={!!error}
                  isDisabled={!!isBuiltin}
                >
                  <Label>Description{isBuiltin ? "" : " (optional)"}</Label>
                  <Input placeholder="e.g. rate the response on correctness" />
                  <FieldError>{error?.message}</FieldError>
                </TextField>
              )}
            />
          </Flex>
          {evaluatorKind === "LLM" && (
            <LLMEvaluatorForm
              showPromptPreview={showPromptPreview}
              setShowPromptPreview={setShowPromptPreview}
              evaluatorInputObject={evaluatorInputObject}
            />
          )}
          {evaluatorKind === "CODE" && (
            <CodeEvaluatorForm evaluatorInputObject={evaluatorInputObject} />
          )}
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
            {/* only show input mapping for non-builtin evaluators */}
            {/* builtin evaluators have hand made forms for their input mapping */}
            {!isBuiltin && (
              <EvaluatorInputMapping
                evaluatorInput={evaluatorInputObject}
                exampleId={selectedExampleId ?? undefined}
              />
            )}
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
