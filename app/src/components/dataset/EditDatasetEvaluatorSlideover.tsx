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
  evaluatorId?: string;
  datasetId: string;
  displayName?: string;
  updateConnectionIds?: string[];
} & ModalOverlayProps;

export const EditDatasetEvaluatorSlideover = ({
  evaluatorId,
  datasetId,
  updateConnectionIds,
  displayName,
  ...props
}: EditDatasetEvaluatorSlideoverProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {!!evaluatorId && !!displayName && (
                <EditEvaluatorPlaygroundProvider
                  evaluatorId={evaluatorId}
                  datasetId={datasetId}
                  displayName={displayName}
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
  const { evaluatorId, datasetId, displayName } = props;
  const datasetEvaluatorQuery =
    useLazyLoadQuery<EditDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query EditDatasetEvaluatorSlideover_evaluatorQuery(
          $datasetId: ID!
          $evaluatorId: ID!
          $displayName: String!
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              evaluator(evaluatorId: $evaluatorId, displayName: $displayName) {
                ... on Evaluator {
                  ... on DatasetLLMEvaluator {
                    prompt {
                      id
                      name
                    }
                    promptVersion {
                      ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
                    }
                  }
                  ...EditDatasetEvaluatorSlideover_evaluator
                }
              }
            }
          }
        }
      `,
      { evaluatorId, datasetId, displayName }
    );
  const datasetEvaluator = datasetEvaluatorQuery.dataset.evaluator;
  invariant(datasetEvaluator != null, "datasetEvaluator is required");
  return (
    <EvaluatorPlaygroundProvider
      promptId={datasetEvaluator.prompt?.id}
      promptName={datasetEvaluator.prompt?.name}
      promptVersionRef={datasetEvaluator.promptVersion}
    >
      <EditEvaluatorDialog queryRef={datasetEvaluator} {...props} />
    </EvaluatorPlaygroundProvider>
  );
};

type EditEvaluatorDialogProps = {
  evaluatorId: string;
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  displayName: string;
  queryRef: EditDatasetEvaluatorSlideover_evaluator$key;
};

const EditEvaluatorDialog = ({
  evaluatorId,
  onClose,
  datasetId,
  updateConnectionIds,
  displayName,
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
        fragment EditDatasetEvaluatorSlideover_evaluator on Evaluator {
          id
          name
          description
          kind
          ... on DatasetLLMEvaluator {
            datasetInputMapping {
              literalMapping
              pathMapping
            }
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
      `,
      queryRef
    );
  const evaluator = evaluatorFragment as Mutable<typeof evaluatorFragment>;
  invariant(evaluator, "evaluator is required");
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
                edgeTypeName: "EvaluatorEdge"
              ) {
              id
              name
              ...EvaluatorsTable_row
              ...EditDatasetEvaluatorSlideover_evaluator
            }
          }
        }
      `
    );
  const defaultValues: EvaluatorFormValues = useMemo(() => {
    return {
      evaluator: {
        name: evaluator.name ?? "",
        description: evaluator.description ?? "",
      },
      choiceConfig: {
        name: evaluator.outputConfig?.name ?? "",
        optimizationDirection:
          evaluator.outputConfig?.optimizationDirection ?? "MAXIMIZE",
        choices: evaluator.outputConfig?.values.map((value) => ({
          label: value.label,
          score: value.score ?? undefined,
        })) ?? [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      },
      dataset: {
        readonly: true,
        id: datasetId,
        assignEvaluatorToDataset: true,
      },
      inputMapping: evaluator.datasetInputMapping ?? {
        literalMapping: {},
        pathMapping: {},
      },
    };
  }, [evaluator, datasetId]);
  const form = useEvaluatorForm(defaultValues);
  const onSubmit = useCallback(() => {
    const {
      evaluator: { name, description },
      dataset,
      choiceConfig,
      inputMapping,
    } = form.getValues();
    invariant(dataset, "dataset is required");
    const input = updateLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      choiceConfig,
      datasetId: dataset.id,
      originalDisplayName: displayName,
      evaluatorId,
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
    displayName,
    evaluatorId,
    updateLlmEvaluator,
    updateConnectionIds,
    onClose,
    notifySuccess,
  ]);

  return (
    <FormProvider {...form}>
      <EditEvaluatorDialogContent
        evaluatorId={evaluatorId}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isUpdating}
        mode="update"
        error={error}
      />
    </FormProvider>
  );
};
