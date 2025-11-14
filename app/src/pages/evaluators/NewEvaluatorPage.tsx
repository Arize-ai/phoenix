import { PropsWithChildren, useCallback, useState } from "react";
import { useForm, useFormContext } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Button, Flex, Heading, Text, View } from "@phoenix/components";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import {
  EvaluatorForm,
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { NewEvaluatorPageContentMutation } from "@phoenix/pages/evaluators/__generated__/NewEvaluatorPageContentMutation.graphql";
import {
  EvaluatorInputMapping,
  InputMapping,
} from "@phoenix/pages/evaluators/EvaluatorInputMapping";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const NewEvaluatorPage = () => {
  const form = useEvaluatorForm();
  return (
    <EvaluatorFormProvider form={form}>
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
    </EvaluatorFormProvider>
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
    control: inputMappingControl,
    getValues: getInputMappingValues,
    formState: { isValid: isInputMappingValid },
  } = useForm<InputMapping>({
    defaultValues: {},
  });
  const {
    formState: { isValid: isEvaluatorValid },
    getValues,
  } = useFormContext<EvaluatorFormValues>();
  const areFormsValid = isEvaluatorValid && isInputMappingValid;
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
    const {
      evaluator: { name, description },
      choiceConfig,
    } = getValues();
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
    const input = createLLMEvaluatorPayload({
      playgroundStore: store,
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
    getInputMappingValues,
    getValues,
    navigate,
    notifyError,
    notifySuccess,
    store,
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
            <EvaluatorForm />
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
