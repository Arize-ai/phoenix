import { PropsWithChildren, useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  FieldError,
  Flex,
  Heading,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import {
  CreateLLMEvaluatorInput,
  NewEvaluatorPageContentMutation,
} from "@phoenix/pages/evaluators/__generated__/NewEvaluatorPageContentMutation.graphql";
import {
  EvaluatorChatTemplate,
  EvaluatorChatTemplateProvider,
} from "@phoenix/pages/evaluators/EvaluatorChatTemplate";
import {
  EvaluatorInputMapping,
  InputMapping,
} from "@phoenix/pages/evaluators/EvaluatorInputMapping";
import {
  ChoiceConfig,
  EvaluatorLLMChoice,
} from "@phoenix/pages/evaluators/EvaluatorLLMChoice";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import { fromOpenAIToolDefinition } from "@phoenix/schemas";
import {
  CategoricalChoiceToolType,
  CategoricalChoiceToolTypeSchema,
} from "@phoenix/schemas/phoenixToolTypeSchemas";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export const NewEvaluatorPage = () => {
  return (
    <EvaluatorChatTemplateProvider>
      <main
        css={css`
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          height: 100%;
          // do not apply padding to the main content area
          // it will break the nested scrolling within the panel group
        `}
      >
        <NewEvaluatorPageContent />
      </main>
    </EvaluatorChatTemplateProvider>
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

const createEvaluatorPayload = ({
  store,
  instanceId,
  name,
  description,
  choiceConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inputMapping,
}: {
  store: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  description: string;
  choiceConfig: ChoiceConfig;
  inputMapping: InputMapping;
}): CreateLLMEvaluatorInput => {
  const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
    instanceId,
    store
  );

  const prunedPromptInput = {
    ...promptInput,
    templateFormat,
    tools: [
      // replace whatever tools exist in the prompt with a categorical choice tool
      {
        definition: fromOpenAIToolDefinition({
          toolDefinition: CategoricalChoiceToolTypeSchema.parse({
            type: "function",
            function: {
              name: choiceConfig.name,
              description: description,
              parameters: {
                type: "string",
                enum: choiceConfig.choices.map((choice) => choice.label),
                required: [],
              },
            },
          } satisfies CategoricalChoiceToolType),
          targetProvider: promptInput.modelProvider,
        }),
      },
    ],
    responseFormat: undefined,
  };

  return {
    name,
    description,
    // TODO: add input mapping
    promptVersion: prunedPromptInput,
    outputConfig: {
      name: choiceConfig.name,
      optimizationDirection: "MAXIMIZE",
      values: choiceConfig.choices.map((choice) => ({
        label: choice.label,
        score: choice.score,
      })),
    },
  };
};

const NewEvaluatorPageContent = () => {
  const store = usePlaygroundStore();
  const { variableKeys: variables } = useDerivedPlaygroundVariables();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );
  const navigate = useNavigate();
  const {
    control: nameControl,
    getValues: getNameValues,
    formState: { isValid: isNameValid },
  } = useForm<{
    name: string;
    description: string;
  }>({
    defaultValues: {
      name: "",
      description: "",
    },
    mode: "onChange",
  });
  const {
    control: choiceConfigControl,
    getValues: getChoiceConfigValues,
    formState: { isValid: isChoiceConfigValid },
  } = useForm<ChoiceConfig>({
    defaultValues: {
      name: "",
      choices: [
        { label: "", score: undefined },
        { label: "", score: undefined },
      ],
    },
  });
  const {
    control: inputMappingControl,
    getValues: getInputMappingValues,
    formState: { isValid: isInputMappingValid },
  } = useForm<InputMapping>({
    defaultValues: {},
  });
  const areFormsValid =
    isNameValid && isChoiceConfigValid && isInputMappingValid;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [createEvaluator, isCreatingEvaluator] =
    useMutation<NewEvaluatorPageContentMutation>(graphql`
      mutation NewEvaluatorPageContentMutation(
        $input: CreateLLMEvaluatorInput!
      ) {
        createLlmEvaluator(input: $input) {
          evaluator {
            id
            name
          }
        }
      }
    `);
  const handleSave = useCallback(() => {
    if (!areFormsValid) {
      return;
    }
    const { name, description } = getNameValues();
    const choiceConfig = getChoiceConfigValues();
    const inputMapping = getInputMappingValues();
    const instance = store.getState().instances[0];
    if (!instance) {
      notifyError({
        title: "Could not create evaluator",
        message:
          "Ensure that your prompt has messages, or restart the page and try again.",
      });
      return;
    }
    const input = createEvaluatorPayload({
      store,
      instanceId: instance.id,
      name,
      description,
      choiceConfig,
      inputMapping,
    });
    createEvaluator({
      variables: {
        input,
      },
      onCompleted: (response) => {
        notifySuccess({
          title: "Evaluator created",
          message: `Evaluator (${response.createLlmEvaluator.evaluator.id}) "${response.createLlmEvaluator.evaluator.name}" created successfully`,
        });
        navigate("/evaluators");
      },
      onError: (error) => {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to create evaluator",
          message: errorMessages?.join("\n") ?? undefined,
        });
      },
    });
  }, [
    areFormsValid,
    createEvaluator,
    getNameValues,
    getChoiceConfigValues,
    getInputMappingValues,
    notifyError,
    notifySuccess,
    store,
    navigate,
  ]);

  return (
    <>
      <View
        borderColor="dark"
        borderBottomWidth="thin"
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Heading level={2}>New Evaluator</Heading>
          <Flex direction="row" alignItems="center" gap="size-100">
            <Button size="M">Cancel</Button>
            <Button
              variant="primary"
              size="M"
              onClick={handleSave}
              isPending={isCreatingEvaluator}
              isDisabled={!areFormsValid}
            >
              {isCreatingEvaluator ? "Creating..." : "Save"}
            </Button>
          </Flex>
        </Flex>
      </View>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={65} css={panelCSS} style={panelStyle}>
          <PanelContainer>
            <Flex
              direction="row"
              alignItems="baseline"
              width="100%"
              gap="size-100"
              marginTop="size-100"
            >
              <Controller
                name="name"
                control={nameControl}
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
                name="description"
                control={nameControl}
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
              <EvaluatorLLMChoice control={choiceConfigControl} />
            </Flex>
            <Flex direction="column" gap="size-100">
              <Heading level={3}>Prompt</Heading>
              <Alert showIcon={false} variant="success">
                Tip: Your eval categories are visible to the LLM, so don&apos;t
                redefine them in your prompt. This needs to be phrased better,
                but generally we should explain what not to do for this.
              </Alert>
              <EvaluatorChatTemplate />
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
                margin-top: var(--ac-global-dimension-static-size-400);
              `}
            >
              <Flex direction="column" gap="size-100">
                <Heading level={3}>Test your evaluator</Heading>
                <Text color="text-500">
                  Use examples from an existing dataset as a reference, or
                  create new examples from scratch.
                </Text>
                <EvaluatorExampleDataset
                  selectedDatasetId={selectedDatasetId}
                  onSelectDataset={setSelectedDatasetId}
                  selectedSplitIds={selectedSplitIds}
                  onSelectSplits={setSelectedSplitIds}
                  onSelectExampleId={setSelectedExampleId}
                />
              </Flex>
              <EvaluatorInputMapping
                exampleId={selectedExampleId ?? undefined}
                control={inputMappingControl}
                variables={variables}
              />
            </div>
          </PanelContainer>
        </Panel>
      </PanelGroup>
    </>
  );
};
