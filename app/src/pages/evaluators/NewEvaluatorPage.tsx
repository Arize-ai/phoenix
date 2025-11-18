import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Heading,
  HeadingProps,
  LinkButton,
  View,
} from "@phoenix/components";
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

export const NewEvaluatorPageContent = ({
  onCancelRedirect = "/evaluators",
  onSuccessRedirect = "/evaluators",
  level = 2,
  updateConnectionIds,
}: {
  /** The redirect URL to navigate to when the evaluator is saved successfully */
  onSuccessRedirect?: string;
  /** The redirect URL to navigate to when the user clicks the cancel button */
  onCancelRedirect?: string;
  /** The level of the primary form heading to display */
  level?: HeadingProps["level"];
  /**
   * Relay connection IDs to update. These must be connections of EvaluatorDatasetEdge types.
   */
  updateConnectionIds?: string[];
}) => {
  const store = usePlaygroundStore();
  const {
    formState: { isValid: isEvaluatorValid },
    getValues,
    watch,
  } = useFormContext<EvaluatorFormValues>();
  const selectedDatasetId = watch("dataset.id");
  const navigate = useNavigate();
  const areFormsValid = isEvaluatorValid;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [createEvaluator, isCreatingEvaluator] =
    useMutation<NewEvaluatorPageContentMutation>(graphql`
      mutation NewEvaluatorPageContentMutation(
        $input: CreateLLMEvaluatorInput!
        $connectionIds: [ID!]!
      ) {
        createLlmEvaluator(input: $input) {
          evaluator
            @appendNode(
              connections: $connectionIds
              edgeTypeName: "EvaluatorEdge"
            ) {
            id
            name
            ...EvaluatorsTable_row
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
      inputMapping,
    } = getValues();
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
      datasetId: selectedDatasetId,
      description,
      choiceConfig,
      inputMapping,
    });
    createEvaluator({
      variables: {
        input,
        connectionIds: updateConnectionIds ?? [],
      },
      onCompleted: (response) => {
        notifySuccess({
          title: "Evaluator created",
          message: `Evaluator (${response.createLlmEvaluator.evaluator.id}) "${response.createLlmEvaluator.evaluator.name}" created successfully`,
        });
        navigate(onSuccessRedirect);
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
    getValues,
    navigate,
    onSuccessRedirect,
    selectedDatasetId,
    notifyError,
    notifySuccess,
    store,
    updateConnectionIds,
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
          <Heading level={level}>New Evaluator</Heading>
          <Flex direction="row" alignItems="center" gap="size-100">
            <LinkButton size="S" to={onCancelRedirect}>
              Cancel
            </LinkButton>
            <Button
              variant="primary"
              size="S"
              onClick={handleSave}
              isPending={isCreatingEvaluator}
              isDisabled={!areFormsValid}
            >
              {isCreatingEvaluator ? "Creating..." : "Save"}
            </Button>
          </Flex>
        </Flex>
      </View>
      <EvaluatorForm />
    </>
  );
};
