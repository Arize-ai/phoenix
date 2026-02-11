import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import type { EditLLMDatasetEvaluatorSlideover_evaluator$key } from "@phoenix/components/dataset/__generated__/EditLLMDatasetEvaluatorSlideover_evaluator.graphql";
import type { EditLLMDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/EditLLMDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import type { EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  getOutputConfigValidationErrors,
  inferIncludeExplanationFromPrompt,
  updateLLMEvaluatorPayload,
} from "@phoenix/components/evaluators/utils";
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
import { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditLLMDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
} & ModalOverlayProps;

export const EditLLMDatasetEvaluatorSlideover = ({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  ...props
}: EditLLMDatasetEvaluatorSlideoverProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {!!datasetEvaluatorId && (
                <EditEvaluatorPlaygroundProvider
                  datasetEvaluatorId={datasetEvaluatorId}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onClose={close}
                  onUpdate={onUpdate}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const EditEvaluatorPlaygroundProvider = (
  props: Omit<EditEvaluatorDialogProps, "queryRef">
) => {
  const { datasetEvaluatorId, datasetId } = props;
  const datasetEvaluatorQuery =
    useLazyLoadQuery<EditLLMDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query EditLLMDatasetEvaluatorSlideover_evaluatorQuery(
          $datasetId: ID!
          $datasetEvaluatorId: ID!
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
                evaluator {
                  ... on LLMEvaluator {
                    prompt {
                      id
                      name
                    }
                    promptVersion {
                      templateFormat
                      ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
                    }
                    promptVersionTag {
                      name
                    }
                  }
                }
                ...EditLLMDatasetEvaluatorSlideover_evaluator
              }
            }
          }
        }
      `,
      { datasetEvaluatorId, datasetId },
      { fetchPolicy: "network-only" }
    );
  const datasetEvaluator = datasetEvaluatorQuery.dataset.datasetEvaluator;
  invariant(datasetEvaluator != null, "datasetEvaluator is required");
  return (
    <EvaluatorPlaygroundProvider
      promptId={datasetEvaluator.evaluator.prompt?.id}
      promptName={datasetEvaluator.evaluator.prompt?.name}
      promptVersionRef={datasetEvaluator.evaluator.promptVersion}
      promptVersionTag={datasetEvaluator.evaluator.promptVersionTag?.name}
      templateFormat={datasetEvaluator.evaluator.promptVersion?.templateFormat}
    >
      <EditEvaluatorDialog queryRef={datasetEvaluator} {...props} />
    </EvaluatorPlaygroundProvider>
  );
};

type EditEvaluatorDialogProps = {
  datasetEvaluatorId: string;
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
  queryRef: EditLLMDatasetEvaluatorSlideover_evaluator$key;
};

const EditEvaluatorDialog = ({
  datasetEvaluatorId,
  onClose,
  datasetId,
  updateConnectionIds,
  onUpdate,
  queryRef,
}: EditEvaluatorDialogProps) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");

  const evaluatorFragment =
    useFragment<EditLLMDatasetEvaluatorSlideover_evaluator$key>(
      graphql`
        fragment EditLLMDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {
          id
          name
          inputMapping {
            literalMapping
            pathMapping
          }
          outputConfigs {
            ... on CategoricalAnnotationConfig {
              name
              optimizationDirection
              values {
                label
                score
              }
            }
            ... on ContinuousAnnotationConfig {
              name
              optimizationDirection
              lowerBound
              upperBound
            }
          }
          evaluator {
            description
            kind
            name
            ... on LLMEvaluator {
              outputConfigs {
                ... on CategoricalAnnotationConfig {
                  name
                  optimizationDirection
                  values {
                    label
                    score
                  }
                }
              }
              prompt {
                id
                name
              }
              promptVersion {
                tools {
                  definition
                }
                ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              }
            }
          }
        }
      `,
      queryRef
    );
  const datasetEvaluator = evaluatorFragment as Mutable<
    typeof evaluatorFragment
  >;
  invariant(datasetEvaluator, "evaluator is required");
  const [updateLlmEvaluator, isUpdating] =
    useMutation<EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation>(
      graphql`
        mutation EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation(
          $input: UpdateDatasetLLMEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          updateDatasetLlmEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              id
              name
              evaluator {
                name
              }
              ...DatasetEvaluatorsTable_row
              ...PlaygroundDatasetSection_evaluator
              ...EditLLMDatasetEvaluatorSlideover_evaluator
              ...LLMDatasetEvaluatorDetails_datasetEvaluator
            }
          }
        }
      `
    );
  const initialState = useMemo(() => {
    const includeExplanation = inferIncludeExplanationFromPrompt(
      datasetEvaluator.evaluator.promptVersion?.tools
    );
    // Load all output configs from the evaluator data, falling back to evaluator's defaults
    const loadedOutputConfigs = (
      datasetEvaluator.outputConfigs?.length
        ? datasetEvaluator.outputConfigs
        : datasetEvaluator.evaluator.outputConfigs
    ) as Mutable<ClassificationEvaluatorAnnotationConfig>[] | undefined;
    // Ensure we have at least the default config
    const outputConfigs =
      loadedOutputConfigs && loadedOutputConfigs.length > 0
        ? loadedOutputConfigs
        : DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs;
    return {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
      evaluator: {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
        globalName:
          datasetEvaluator.evaluator.name ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName,
        name:
          datasetEvaluator.name ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.name,
        description:
          datasetEvaluator.evaluator.description ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.description,
        kind: datasetEvaluator.evaluator.kind,
        isBuiltin: false,
        inputMapping:
          datasetEvaluator.inputMapping ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.inputMapping,
        includeExplanation,
      },
      datasetEvaluator: {
        id: datasetEvaluatorId,
      },
      outputConfigs,
      dataset: {
        readonly: true,
        id: datasetId,
        selectedExampleId: null,
        selectedSplitIds: [],
      },
    } satisfies EvaluatorStoreProps;
  }, [datasetEvaluator, datasetId, datasetEvaluatorId]);
  const onSubmit = useCallback(
    (store: EvaluatorStoreInstance) => {
      const {
        evaluator: { name, description, inputMapping, includeExplanation },
        dataset,
        outputConfigs,
      } = store.getState();
      invariant(dataset, "dataset is required");
      invariant(
        outputConfigs && outputConfigs.length > 0,
        "At least one output config is required"
      );

      // Validate output configs before submit
      const validationErrors = getOutputConfigValidationErrors(outputConfigs);
      if (validationErrors.length > 0) {
        setError(validationErrors.join("\n"));
        return;
      }

      const input = updateLLMEvaluatorPayload({
        playgroundStore,
        instanceId,
        name,
        description,
        outputConfigs,
        datasetId: dataset.id,
        datasetEvaluatorId,
        inputMapping,
        includeExplanation,
      });
      updateLlmEvaluator({
        variables: {
          input,
          connectionIds: updateConnectionIds ?? [],
        },
        onCompleted: () => {
          onClose();
          notifySuccess({
            title: "Evaluator updated",
          });
          if (onUpdate) {
            onUpdate();
          }
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
      datasetEvaluatorId,
      updateLlmEvaluator,
      updateConnectionIds,
      onClose,
      notifySuccess,
      onUpdate,
    ]
  );

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditLLMEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isUpdating}
          mode="update"
          error={error}
        />
      )}
    </EvaluatorStoreProvider>
  );
};
