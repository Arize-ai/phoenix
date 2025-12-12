import { Suspense, useCallback, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { FormProvider } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
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
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const CreateLLMDatasetEvaluatorSlideover = ({
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
