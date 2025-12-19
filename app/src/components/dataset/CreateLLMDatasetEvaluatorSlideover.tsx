import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import {
  convertPromptVersionMessagesToPlaygroundInstanceMessages,
  type PromptVersionMessageFragments,
} from "@phoenix/utils/promptUtils";

export type CreateLLMDatasetEvaluatorInitialState = {
  name: string;
  description: string;
  outputConfig: ClassificationEvaluatorAnnotationConfig;
  promptMessages: PromptVersionMessageFragments;
};

export const CreateLLMDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  initialState,
  onEvaluatorCreated,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  initialState?: CreateLLMDatasetEvaluatorInitialState;
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
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
                    onEvaluatorCreated={onEvaluatorCreated}
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
  initialState: _initialState,
  onEvaluatorCreated,
}: {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  initialState?: CreateLLMDatasetEvaluatorInitialState;
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
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
  const initialState = useMemo(() => {
    return {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
      evaluator: {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
        name:
          _initialState?.name ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.name,
        description:
          _initialState?.description ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.description,
      },
      outputConfig:
        _initialState?.outputConfig ??
        DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfig,
      dataset: {
        readonly: true,
        id: datasetId,
        selectedExampleId: null,
        selectedSplitIds: [],
      },
    } satisfies EvaluatorStoreProps;
  }, [datasetId, _initialState]);
  const onSubmit = useCallback(
    (store: EvaluatorStoreInstance) => {
      const {
        evaluator: { name, description, inputMapping, includeExplanation },
        dataset,
        outputConfig,
      } = store.getState();
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
        includeExplanation,
      });
      createLlmEvaluator({
        variables: {
          input,
          connectionIds: updateConnectionIds ?? [],
        },
        onCompleted: (response) => {
          const createdId = response.createDatasetLlmEvaluator.evaluator.id;
          onEvaluatorCreated?.(createdId);
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
    },
    [
      playgroundStore,
      instanceId,
      createLlmEvaluator,
      updateConnectionIds,
      onClose,
      notifySuccess,
      onEvaluatorCreated,
    ]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditLLMEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isCreating}
          mode="create"
          error={error}
        />
      )}
    </EvaluatorStoreProvider>
  );
};
