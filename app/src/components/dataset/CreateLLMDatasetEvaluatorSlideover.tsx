import { Suspense, useCallback, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay/ViewportModal";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay/ViewportModal";
import type { CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
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
  outputConfigs: ClassificationEvaluatorAnnotationConfig[];
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
} & Omit<ViewportModalOverlayProps, "children">) => {
  const defaultMessages = useMemo(() => {
    if (initialState?.promptMessages) {
      return convertPromptVersionMessagesToPlaygroundInstanceMessages({
        promptMessagesRefs: initialState?.promptMessages ?? [],
      });
    }
    return undefined;
  }, [initialState]);
  return (
    <ViewportModalOverlay {...props}>
      <ViewportModal size="fullscreen">
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
      </ViewportModal>
    </ViewportModalOverlay>
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
              name
              ...PlaygroundDatasetSection_evaluator
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
    const defaultOutputConfig =
      _initialState?.outputConfigs?.[0] ??
      DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs[0];
    const defaultEvaluatorName =
      _initialState?.name ??
      DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName;
    // Build the output config with the evaluator name
    const outputConfigWithName = {
      ...defaultOutputConfig,
      name: defaultEvaluatorName,
    };
    return {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
      evaluator: {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
        globalName: defaultEvaluatorName,
        description:
          _initialState?.description ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.description,
      },
      // Initialize outputConfigs with the single config in an array
      outputConfigs: [outputConfigWithName],
      dataset: {
        readonly: true,
        id: datasetId,
        selectedExampleId: null,
        selectedSplitIds: [],
      },
    } satisfies EvaluatorStoreProps;
  }, [datasetId, _initialState]);
  const onSubmit = useCallback(
    (store: EvaluatorStoreInstance): Promise<EvaluatorSubmitResult> => {
      const {
        evaluator: {
          globalName,
          description,
          inputMapping,
          includeExplanation,
        },
        dataset,
        outputConfigs,
      } = store.getState();
      invariant(dataset, "dataset is required");
      invariant(
        outputConfigs && outputConfigs.length > 0,
        "At least one output config is required"
      );

      // Validate output configs before submitting
      const validationErrors = getOutputConfigValidationErrors(outputConfigs);
      if (validationErrors.length > 0) {
        const message = validationErrors.join("\n");
        setError(message);
        return Promise.resolve({ ok: false, error: message });
      }

      const input = createLLMEvaluatorPayload({
        playgroundStore,
        instanceId,
        name: globalName,
        description,
        outputConfigs,
        datasetId: dataset.id,
        inputMapping,
        includeExplanation,
      });
      return new Promise<EvaluatorSubmitResult>((resolve) => {
        createLlmEvaluator({
          variables: {
            input,
            connectionIds: updateConnectionIds ?? [],
          },
          onCompleted: (response) => {
            const createdEvaluator =
              response.createDatasetLlmEvaluator.evaluator;
            onEvaluatorCreated?.(createdEvaluator.id);
            onClose();
            notifySuccess({
              title: "Evaluator created",
            });
            resolve({
              ok: true,
              acceptedBy: "user",
              evaluator: {
                id: createdEvaluator.id,
                name: createdEvaluator.name,
              },
            });
          },
          onError: (error) => {
            const message =
              getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
              error.message;
            setError(message);
            resolve({ ok: false, error: message });
          },
        });
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
