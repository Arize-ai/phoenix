import { Suspense, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import {
  Dialog,
  DialogContent,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import type { CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation.graphql";
import { EditCodeEvaluatorDialogContent } from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { useNotifySuccess } from "@phoenix/contexts";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export function CreateCodeDatasetEvaluatorSlideover({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (evaluatorId: string) => void;
} & ModalOverlayProps) {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Create code evaluator">
          {({ close }) => (
            <DialogContent minHeight="300px">
              <Suspense
                fallback={
                  <Flex flex={1} alignItems="center">
                    <Loading />
                  </Flex>
                }
              >
                <EvaluatorPlaygroundProvider>
                  <CreateCodeDatasetEvaluatorSlideoverContent
                    datasetId={datasetId}
                    updateConnectionIds={updateConnectionIds}
                    onClose={close}
                    onEvaluatorCreated={onEvaluatorCreated}
                  />
                </EvaluatorPlaygroundProvider>
              </Suspense>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CreateCodeDatasetEvaluatorSlideoverContent({
  datasetId,
  updateConnectionIds,
  onClose,
  onEvaluatorCreated,
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onClose: () => void;
  onEvaluatorCreated?: (evaluatorId: string) => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const [createDatasetCodeEvaluator, isCreating] =
    useMutation<CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation>(
      graphql`
        mutation CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation(
          $input: CreateDatasetCodeEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createDatasetCodeEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              id
              name
              ...PlaygroundDatasetSection_evaluator
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      `
    );

  const initialState = {
    ...DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES,
    dataset: {
      readonly: true,
      id: datasetId,
      selectedExampleId: null,
      selectedSplitIds: [],
    },
  } satisfies EvaluatorStoreProps;

  const onSubmit = (store: EvaluatorStoreInstance) => {
    setError(undefined);
    const {
      evaluator: { globalName, description, inputMapping },
      sourceCode,
      language,
      outputConfigs,
      sandboxBackendType,
    } = store.getState();

    const normalizedDescription = description.trim() || null;

    createDatasetCodeEvaluator({
      variables: {
        input: {
          datasetId,
          name: globalName,
          sourceCode,
          language,
          inputMapping,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          description: normalizedDescription,
          sandboxBackendType:
            sandboxBackendType as CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation["variables"]["input"]["sandboxBackendType"],
        },
        connectionIds: updateConnectionIds ?? [],
      },
      updater: (store) => {
        const datasetRecord = store.get(datasetId);
        if (datasetRecord) {
          const count = datasetRecord.getValue("evaluatorCount") as number;
          datasetRecord.setValue(count + 1, "evaluatorCount");
        }
      },
      onCompleted: (response) => {
        const createdId = response.createDatasetCodeEvaluator.evaluator.id;
        onEvaluatorCreated?.(createdId);
        onClose();
        notifySuccess({
          title: "Code evaluator created",
        });
      },
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditCodeEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isCreating}
          mode="create"
          error={error}
        />
      )}
    </EvaluatorStoreProvider>
  );
}
