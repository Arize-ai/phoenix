import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
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
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
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

export const EditDatasetEvaluatorSlideover = ({
  evaluatorId,
  datasetId,
  updateConnectionIds,
  displayName,
  ...props
}: {
  evaluatorId: string;
  datasetId: string;
  displayName: string;
  updateConnectionIds?: string[];
} & ModalOverlayProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              <EditEvaluatorDialog
                evaluatorId={evaluatorId}
                onClose={close}
                datasetId={datasetId}
                updateConnectionIds={updateConnectionIds}
                displayName={displayName}
              />
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const EditEvaluatorDialog = ({
  evaluatorId,
  onClose,
  datasetId,
  updateConnectionIds,
  displayName,
}: {
  evaluatorId: string;
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  displayName: string;
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");
  const query = useLazyLoadQuery<EditDatasetEvaluatorSlideover_evaluatorQuery>(
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
                ...EditDatasetEvaluatorSlideover_evaluator
              }
            }
          }
        }
      }
    `,
    { evaluatorId, datasetId, displayName }
  );
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
          }
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
      `,
      query.dataset.evaluator
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
      inputMapping: evaluator.datasetInputMapping ?? {},
    };
  }, [evaluator, datasetId]);
  const form = useEvaluatorForm(defaultValues);
  const onSubmit = useCallback(() => {
    const {
      evaluator: { name, description },
      dataset,
      choiceConfig,
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
    <EvaluatorFormProvider
      form={form}
      promptId={evaluator.prompt?.id}
      promptName={evaluator.prompt?.name}
      promptVersionRef={evaluator.promptVersion}
    >
      <EditEvaluatorDialogContent
        evaluatorId={evaluatorId}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isUpdating}
        mode="update"
        error={error}
      />
    </EvaluatorFormProvider>
  );
};
