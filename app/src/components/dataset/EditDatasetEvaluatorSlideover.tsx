import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { FormProvider } from "react-hook-form";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import { EditDatasetEvaluatorSlideover_evaluator$key } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_evaluator.graphql";
import { EditDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import { EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditEvaluatorDialogContent } from "@phoenix/components/evaluators/EditEvaluatorDialogContent";
import {
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { updateLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string;
  datasetId: string;
  updateConnectionIds?: string[];
} & ModalOverlayProps;

export const EditDatasetEvaluatorSlideover = ({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  ...props
}: EditDatasetEvaluatorSlideoverProps) => {
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
    useLazyLoadQuery<EditDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query EditDatasetEvaluatorSlideover_evaluatorQuery(
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
                      ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
                    }
                    promptVersionTag {
                      name
                    }
                  }
                }
                ...EditDatasetEvaluatorSlideover_evaluator
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
  queryRef: EditDatasetEvaluatorSlideover_evaluator$key;
};

const EditEvaluatorDialog = ({
  datasetEvaluatorId,
  onClose,
  datasetId,
  updateConnectionIds,
  queryRef,
}: EditEvaluatorDialogProps) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");

  const evaluatorFragment =
    useFragment<EditDatasetEvaluatorSlideover_evaluator$key>(
      graphql`
        fragment EditDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {
          id
          displayName
          inputMapping {
            literalMapping
            pathMapping
          }
          evaluator {
            description
            kind
            ... on LLMEvaluator {
              prompt {
                id
                name
              }
              promptVersion {
                ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              }
              outputConfig {
                name
                optimizationDirection
                values {
                  label
                  score
                }
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
    useMutation<EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation>(
      graphql`
        mutation EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation(
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
              displayName
              ...DatasetEvaluatorsTable_row
              ...EditDatasetEvaluatorSlideover_evaluator
            }
          }
        }
      `
    );
  const defaultValues: EvaluatorFormValues = useMemo(() => {
    return {
      evaluator: {
        name: datasetEvaluator.displayName ?? "",
        description: datasetEvaluator.evaluator.description ?? "",
        kind: datasetEvaluator.evaluator.kind,
        isBuiltin: false,
      },
      outputConfig: {
        name: datasetEvaluator.evaluator.outputConfig?.name ?? "",
        optimizationDirection:
          datasetEvaluator.evaluator.outputConfig?.optimizationDirection ??
          "MAXIMIZE",
        values: datasetEvaluator.evaluator.outputConfig?.values.map(
          (value) => ({
            label: value.label,
            score: value.score ?? undefined,
          })
        ) ?? [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      },
      dataset: {
        readonly: true,
        id: datasetId,
        assignEvaluatorToDataset: true,
      },
      inputMapping: datasetEvaluator.inputMapping ?? {
        literalMapping: {},
        pathMapping: {},
      },
    };
  }, [datasetEvaluator, datasetId]);
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
    const input = updateLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig,
      datasetId: dataset.id,
      datasetEvaluatorId,
      inputMapping,
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
    datasetEvaluatorId,
    updateLlmEvaluator,
    updateConnectionIds,
    onClose,
    notifySuccess,
  ]);

  return (
    <FormProvider {...form}>
      <EditEvaluatorDialogContent
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isUpdating}
        mode="update"
        error={error}
      />
    </FormProvider>
  );
};
