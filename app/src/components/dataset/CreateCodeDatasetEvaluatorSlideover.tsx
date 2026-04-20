import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay/Modal";
import type { CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation.graphql";
import type { CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation.graphql";
import type { CreateCodeDatasetEvaluatorSlideoverQuery } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideoverQuery.graphql";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { DEFAULT_CODE_EVALUATOR_SOURCE } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import {
  createDefaultContinuousOutputConfig,
  EditCodeEvaluatorDialogContent,
} from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  EVALUATOR_MAPPING_SOURCE_DEFAULT,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const CreateCodeDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  onOpenChange,
  isOpen,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
} & ModalOverlayProps) => {
  const isDirtyRef = useRef(false);

  // Reset dirty state when slideover opens
  useEffect(() => {
    if (isOpen) {
      isDirtyRef.current = false;
    }
  }, [isOpen]);

  const handleOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      if (!nextIsOpen && isDirtyRef.current) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to close?"
        );
        if (!confirmed) return;
      }
      onOpenChange?.(nextIsOpen);
    },
    [onOpenChange]
  );

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  return (
    <ModalOverlay {...props} isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              <CreateCodeEvaluatorDialog
                onClose={close}
                onDirtyChange={handleDirtyChange}
                datasetId={datasetId}
                updateConnectionIds={updateConnectionIds}
                onEvaluatorCreated={onEvaluatorCreated}
              />
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const CreateCodeEvaluatorDialog = ({
  onClose,
  onDirtyChange,
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
}: {
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>();
  const data = useLazyLoadQuery<CreateCodeDatasetEvaluatorSlideoverQuery>(
    graphql`
      query CreateCodeDatasetEvaluatorSlideoverQuery {
        sandboxProviders {
          backendType
          language
          enabled
          configs {
            id
            name
            description
          }
        }
        sandboxBackends {
          backendType
          status
        }
      }
    `,
    {}
  );
  const sandboxConfigs = mapSandboxConfigOptions(
    data.sandboxProviders,
    data.sandboxBackends
  );
  const [createCodeEvaluator, isCreatingCodeEvaluator] =
    useMutation<CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation>(graphql`
      mutation CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation(
        $input: CreateCodeEvaluatorInput!
      ) {
        createCodeEvaluator(input: $input) {
          evaluator {
            id
          }
        }
      }
    `);
  const [createDatasetCodeEvaluator, isCreatingDatasetCodeEvaluator] =
    useMutation<CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation>(graphql`
      mutation CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation(
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
            ...PlaygroundDatasetSection_evaluator
            ...DatasetEvaluatorsTable_row
          }
        }
      }
    `);
  const initialState: EvaluatorStoreProps = {
    evaluator: {
      globalName: "",
      name: "",
      description: "",
      inputMapping: {
        literalMapping: {},
        pathMapping: {},
      },
      kind: "CODE",
      isBuiltin: false,
      includeExplanation: false,
    },
    outputConfigs: [createDefaultContinuousOutputConfig("")],
    dataset: {
      readonly: true,
      id: datasetId,
      selectedExampleId: null,
      selectedSplitIds: [],
    },
    evaluatorMappingSource: EVALUATOR_MAPPING_SOURCE_DEFAULT,
    showPromptPreview: false,
  };

  const onSubmit = (
    store: EvaluatorStoreInstance,
    payload: {
      language: "PYTHON" | "TYPESCRIPT";
      sourceCode: string;
      sandboxConfigId?: string | null;
    }
  ) => {
    setError(undefined);
    const {
      evaluator: { globalName, name, description, inputMapping },
      outputConfigs,
    } = store.getState();
    const normalizedName = (globalName || name).trim();
    const normalizedDescription = description.trim() || undefined;
    invariant(normalizedName, "evaluator name is required");

    createCodeEvaluator({
      variables: {
        input: {
          name: normalizedName,
          description: normalizedDescription,
          sourceCode: payload.sourceCode,
          language: payload.language,
          sandboxConfigId: payload.sandboxConfigId,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          inputMapping,
        },
      },
      onCompleted: (response) => {
        const evaluatorId = response.createCodeEvaluator.evaluator.id;
        createDatasetCodeEvaluator({
          variables: {
            input: {
              datasetId,
              evaluatorId,
              name: normalizedName,
              description: normalizedDescription,
              outputConfigs: buildOutputConfigsInput(outputConfigs),
              inputMapping,
            },
            connectionIds: updateConnectionIds ?? [],
          },
          onCompleted: (datasetResponse) => {
            const createdId =
              datasetResponse.createDatasetCodeEvaluator.evaluator.id;
            onEvaluatorCreated?.(createdId);
            notifySuccess({
              title: "Evaluator created",
              message: "The code evaluator has been added to the dataset.",
            });
            onDirtyChange?.(false);
            onClose();
          },
          onError: (mutationError) => {
            setError(
              getErrorMessagesFromRelayMutationError(mutationError)?.join(
                "\n"
              ) ?? mutationError.message
            );
          },
        });
      },
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message
        );
      },
    });
  };

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditCodeEvaluatorDialogContent
          onSubmit={(payload) => onSubmit(store, payload)}
          onCancel={onClose}
          onDirtyChange={onDirtyChange}
          isSubmitting={
            isCreatingCodeEvaluator || isCreatingDatasetCodeEvaluator
          }
          mode="create"
          error={error}
          initialLanguage="PYTHON"
          initialSourceCode={DEFAULT_CODE_EVALUATOR_SOURCE.PYTHON}
          sandboxConfigs={sandboxConfigs}
          initialSandboxConfigId={null}
        />
      )}
    </EvaluatorStoreProvider>
  );
};
