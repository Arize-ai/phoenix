import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { FormProvider } from "react-hook-form";
import { graphql, readInlineData, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import type { CreateLLMDatasetEvaluatorSlideover_promptMessages$key } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_promptMessages.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import {
  DEFAULT_LLM_FORM_VALUES,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getChatRole } from "@phoenix/pages/playground/playgroundUtils";
import { generateMessageId } from "@phoenix/store";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type CreateLLMDatasetEvaluatorInitialState = {
  name: string;
  description: string;
  outputConfig: ClassificationEvaluatorAnnotationConfig;
  promptMessages: Readonly<
    CreateLLMDatasetEvaluatorSlideover_promptMessages$key[]
  >;
};

const convertPromptVersionMessagesToPlaygroundInstanceMessages = ({
  promptMessagesRefs,
}: {
  promptMessagesRefs: Readonly<
    CreateLLMDatasetEvaluatorSlideover_promptMessages$key[]
  >;
}) => {
  const promptMessages = promptMessagesRefs.map(
    (message) =>
      readInlineData<CreateLLMDatasetEvaluatorSlideover_promptMessages$key>(
        graphql`
          fragment CreateLLMDatasetEvaluatorSlideover_promptMessages on PromptMessage
          @inline {
            content {
              ... on TextContentPart {
                text {
                  text
                }
              }
            }
            role
          }
        `,
        message
      )
  );

  const instanceMessages = promptMessages.map((message) => ({
    id: generateMessageId(),
    content: message.content
      .map((content) => content.text?.text ?? "")
      .filter(Boolean)
      .join("\n"),
    role: getChatRole(message.role),
  }));

  return instanceMessages;
};

export const CreateLLMDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  initialState,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  initialState?: CreateLLMDatasetEvaluatorInitialState;
} & ModalOverlayProps) => {
  const defaultMessages = useMemo(() => {
    if (initialState?.promptMessages) {
      return convertPromptVersionMessagesToPlaygroundInstanceMessages({
        promptMessagesRefs: initialState?.promptMessages ?? [],
      });
    }
    return undefined;
  }, [initialState]);
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {datasetId && (
                <EvaluatorPlaygroundProvider defaultMessages={defaultMessages}>
                  <CreateEvaluatorDialog
                    onClose={close}
                    datasetId={datasetId}
                    updateConnectionIds={updateConnectionIds}
                    initialState={initialState}
                  />
                </EvaluatorPlaygroundProvider>
              )}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const CreateEvaluatorDialog = ({
  onClose,
  datasetId,
  updateConnectionIds,
  initialState,
}: {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  initialState?: CreateLLMDatasetEvaluatorInitialState;
}) => {
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const [createLlmEvaluator, isCreating] =
    useMutation<CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation>(
      graphql`
        mutation CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation(
          $input: CreateDatasetLLMEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createDatasetLlmEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              id
              displayName
              evaluator {
                ... on LLMEvaluator {
                  prompt {
                    ...PromptVersionsList__main
                  }
                }
              }
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      `
    );
  const defaultValues: Partial<EvaluatorFormValues> = useMemo(() => {
    return {
      ...DEFAULT_LLM_FORM_VALUES,
      evaluator: {
        ...DEFAULT_LLM_FORM_VALUES.evaluator,
        name: initialState?.name ?? "",
        description: initialState?.description ?? "",
      },
      outputConfig:
        initialState?.outputConfig ?? DEFAULT_LLM_FORM_VALUES.outputConfig,
      dataset: {
        readonly: true,
        id: datasetId,
        assignEvaluatorToDataset: true,
      },
    };
  }, [datasetId, initialState]);
  const form = useEvaluatorForm(defaultValues);
  const onSubmit = useCallback(() => {
    const {
      evaluator: { name, description },
      dataset,
      outputConfig,
      inputMapping,
    } = form.getValues();
    invariant(dataset, "dataset is required");
    invariant(outputConfig, "outputConfig is required");
    const input = createLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig,
      datasetId: dataset.id,
      inputMapping,
    });
    createLlmEvaluator({
      variables: {
        input,
        connectionIds: updateConnectionIds ?? [],
      },
      onCompleted: () => {
        onClose();
        notifySuccess({
          title: "Evaluator created",
        });
      },
      onError: (error) => {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        setError(errorMessages?.join("\n") ?? undefined);
      },
    });
  }, [
    form,
    playgroundStore,
    instanceId,
    createLlmEvaluator,
    updateConnectionIds,
    onClose,
    notifySuccess,
  ]);
  return (
    <FormProvider {...form}>
      <EditLLMEvaluatorDialogContent
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isCreating}
        mode="create"
        error={error}
      />
    </FormProvider>
  );
};
