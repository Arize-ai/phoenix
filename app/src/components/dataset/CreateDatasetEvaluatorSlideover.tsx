import { Suspense, useCallback, useMemo } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import {
  CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation,
  CreateLLMEvaluatorInput,
} from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditEvaluatorDialogContent } from "@phoenix/components/evaluators/EditEvaluatorDialogContent";
import {
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";

export const CreateDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
} & ModalOverlayProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {datasetId && (
                <CreateEvaluatorDialog
                  onClose={close}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                />
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
}: {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
}) => {
  const [createLlmEvaluator, isCreating] =
    useMutation<CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation>(
      graphql`
        mutation CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation(
          $input: CreateDatasetLLMEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createDatasetLlmEvaluator(input: $input) {
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
      `
    );
  const onSubmit = useCallback(
    (args: {
      input: CreateLLMEvaluatorInput;
      onCompleted: ({ name }: { name: string }) => void;
      onError: (error: Error) => void;
    }) => {
      createLlmEvaluator({
        variables: {
          input: args.input,
          connectionIds: updateConnectionIds ?? [],
        },
        onCompleted: (response) => {
          args.onCompleted({
            name: response.createLlmEvaluator.evaluator.name,
          });
        },
        onError: args.onError,
      });
    },
    [createLlmEvaluator, updateConnectionIds]
  );
  const defaultValues: Partial<EvaluatorFormValues> = useMemo(() => {
    return {
      dataset: {
        readonly: true,
        id: datasetId,
        assignEvaluatorToDataset: true,
      },
    };
  }, [datasetId]);
  const form = useEvaluatorForm(defaultValues);

  return (
    <EvaluatorFormProvider form={form}>
      <EditEvaluatorDialogContent
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isCreating}
        mode="create"
      />
    </EvaluatorFormProvider>
  );
};
