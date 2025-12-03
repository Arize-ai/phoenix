import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { ModalOverlayProps } from "react-aria-components";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import { CreateLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { EditDatasetEvaluatorSlideover_evaluator$key } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_evaluator.graphql";
import { EditDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import { EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { UpdateLLMEvaluatorInput } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { EditEvaluatorDialogContent } from "@phoenix/components/evaluators/EditEvaluatorDialogContent";
import {
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { useNotifyError } from "@phoenix/contexts";
import { Mutable } from "@phoenix/typeUtils";

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
  const closedRef = useRef(false);
  const notifyError = useNotifyError();
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
          isAssignedToDataset
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
  useEffect(() => {
    if (!evaluator.isAssignedToDataset && !closedRef.current) {
      onClose();
      notifyError({
        title: "Evaluator not assigned to dataset",
        message:
          "This evaluator is not assigned to this dataset. Please refresh the page and try again.",
      });
      closedRef.current = true;
    }
  }, [evaluator.isAssignedToDataset, onClose, notifyError]);
  const [updateLlmEvaluator, isUpdating] =
    useMutation<EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation>(
      graphql`
        mutation EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation(
          $input: UpdateLLMEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          updateLlmEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "EvaluatorEdge"
              ) {
              id
              name
              ...EvaluatorsTable_row
              ...EditEvaluatorSlideover_evaluator
            }
          }
        }
      `
    );
  const onSubmit = useCallback(
    (args: {
      input: UpdateLLMEvaluatorInput | CreateLLMEvaluatorInput;
      onCompleted: ({ name }: { name: string }) => void;
      onError: (error: Error) => void;
    }) => {
      invariant(
        "evaluatorId" in args.input,
        "evaluatorId is required when updating an evaluator. "
      );
      updateLlmEvaluator({
        variables: {
          input: args.input,
          connectionIds: updateConnectionIds ?? [],
        },
        onCompleted: (response) => {
          args.onCompleted({
            name: response.updateLlmEvaluator.evaluator.name,
          });
        },
        onError: args.onError,
      });
    },
    [updateLlmEvaluator, updateConnectionIds]
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
      inputMapping: {
        // TODO: populate input mapping from evaluator
      },
    };
  }, [evaluator, datasetId]);
  const form = useEvaluatorForm(defaultValues);

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
      />
    </EvaluatorFormProvider>
  );
};
