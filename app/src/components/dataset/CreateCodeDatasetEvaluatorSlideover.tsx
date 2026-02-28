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
  onEvaluatorCreated,
  ...props
}: {
  datasetId: string;
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
  onClose,
  onEvaluatorCreated,
}: {
  datasetId: string;
  onClose: () => void;
  onEvaluatorCreated?: (evaluatorId: string) => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const [createCodeEvaluator, isCreating] =
    useMutation<CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation>(
      graphql`
        mutation CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation(
          $input: CreateCodeEvaluatorInput!
        ) {
          createCodeEvaluator(input: $input) {
            evaluator {
              id
              name
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
      evaluator: { name, description, inputMapping },
      sourceCode,
      language,
      outputConfigs,
    } = store.getState();

    const normalizedDescription = description.trim() || null;

    createCodeEvaluator({
      variables: {
        input: {
          name,
          sourceCode,
          language,
          inputMapping,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          description: normalizedDescription,
        },
      },
      onCompleted: (response) => {
        const createdId = response.createCodeEvaluator.evaluator.id;
        onEvaluatorCreated?.(createdId);
        notifySuccess({
          title: "Code evaluator created",
          message: "The code evaluator has been created.",
        });
        onClose();
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
