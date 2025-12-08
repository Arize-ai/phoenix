import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { FormProvider } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import { CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditEvaluatorDialogContent } from "@phoenix/components/evaluators/EditEvaluatorDialogContent";
import {
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
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

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
                <EvaluatorPlaygroundProvider>
                  <CreateEvaluatorDialog
                    onClose={close}
                    datasetId={datasetId}
                    updateConnectionIds={updateConnectionIds}
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
}: {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
}) => {
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
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
              displayName
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      `
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
  const onSubmit = useCallback(() => {
    const {
      evaluator: { name, description },
      dataset,
      choiceConfig,
      inputMapping,
    } = form.getValues();
    invariant(dataset, "dataset is required");
    const input = createLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      choiceConfig,
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
      <EditEvaluatorDialogContent
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isCreating}
        mode="create"
        error={error}
      />
    </FormProvider>
  );
};
