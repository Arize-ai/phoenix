import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  type CodeEvaluatorDraftSnapshot,
  fromOutputConfigDraft,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay/Modal";
import type { CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation.graphql";
import type { CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation.graphql";
import type { CreateCodeDatasetEvaluatorSlideoverQuery } from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideoverQuery.graphql";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { getDefaultCodeEvaluatorSource } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import {
  createDefaultFreeformOutputConfig,
  EditCodeEvaluatorDialogContent,
} from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  EVALUATOR_MAPPING_SOURCE_DEFAULT,
  type AnnotationConfig,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type CreateCodeDatasetEvaluatorSlideoverSubmitResult = {
  createdEvaluator: { id: string; name: string };
  datasetEvaluatorId: string;
};

export const CreateCodeDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  onSubmitSuccess,
  onSubmitError,
  onOpenChange,
  isOpen,
  initialSnapshot,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  /** Called after the chained mutation succeeds, with the created IDs. */
  onSubmitSuccess?: (
    result: CreateCodeDatasetEvaluatorSlideoverSubmitResult
  ) => void;
  /** Called when the chained mutation fails, with a flattened error message. */
  onSubmitError?: (errorMessage: string) => void;
  /** Optional snapshot used to prefill the form on mount. */
  initialSnapshot?: CodeEvaluatorDraftSnapshot | null;
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
                onSubmitSuccess={onSubmitSuccess}
                onSubmitError={onSubmitError}
                initialSnapshot={initialSnapshot ?? null}
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
  onSubmitSuccess,
  onSubmitError,
  initialSnapshot,
}: {
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  onSubmitSuccess?: (
    result: CreateCodeDatasetEvaluatorSlideoverSubmitResult
  ) => void;
  onSubmitError?: (errorMessage: string) => void;
  initialSnapshot: CodeEvaluatorDraftSnapshot | null;
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>();
  const data = useLazyLoadQuery<CreateCodeDatasetEvaluatorSlideoverQuery>(
    graphql`
      query CreateCodeDatasetEvaluatorSlideoverQuery {
        sandboxProviders {
          backendType
          supportedLanguages
          enabled
          configs {
            id
            name
            description
            language
            timeout
            config {
              envVars {
                name
                secretKey
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
          }
        }
        sandboxBackends {
          backendType
          status
          supportsEnvVars
          internetAccess
          supportsDependencies
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
            name
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
  const initialState: EvaluatorStoreProps = useMemo(() => {
    const seededOutputConfigs: AnnotationConfig[] | null = initialSnapshot
      ? initialSnapshot.outputConfigs.length > 0
        ? initialSnapshot.outputConfigs.map((draft) =>
            fromOutputConfigDraft(draft)
          )
        : null
      : null;
    // `EvaluatorNameInput` binds to `globalName` whenever both
    // `datasetEvaluator.id` and `evaluator.isBuiltin` are absent (see
    // `shouldUseSpecificName` in EvaluatorNameInput.tsx) — which is exactly
    // the create-a-fresh-evaluator state we're in here. If we only seed
    // `evaluator.name` from the snapshot, the visible Name input is bound
    // to an empty `globalName` and looks blank to the user even though
    // submit falls back via `(globalName || name)`. Seed both so the agent's
    // proposed name renders in the field.
    return {
      evaluator: {
        globalName: initialSnapshot?.name ?? "",
        name: initialSnapshot?.name ?? "",
        description: initialSnapshot?.description ?? "",
        inputMapping: initialSnapshot?.inputMapping ?? {
          literalMapping: {},
          pathMapping: {},
        },
        kind: "CODE",
        isBuiltin: false,
        includeExplanation: false,
      },
      outputConfigs: seededOutputConfigs ?? [
        createDefaultFreeformOutputConfig(""),
      ],
      dataset: {
        readonly: true,
        id: datasetId,
        selectedExampleId: null,
        selectedSplitIds: [],
      },
      evaluatorMappingSource: EVALUATOR_MAPPING_SOURCE_DEFAULT,
      showPromptPreview: false,
    };
  }, [datasetId, initialSnapshot]);

  const initialLanguage = initialSnapshot?.language ?? "PYTHON";
  const initialSourceCode =
    initialSnapshot?.sourceCode ?? getDefaultCodeEvaluatorSource("PYTHON");
  const initialSandboxConfigId = initialSnapshot?.sandboxConfigId ?? null;

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
    invariant(
      payload.sandboxConfigId,
      "sandbox config is required to create a code evaluator"
    );

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
        const createdEvaluator = response.createCodeEvaluator.evaluator;
        createDatasetCodeEvaluator({
          variables: {
            input: {
              datasetId,
              evaluatorId: createdEvaluator.id,
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
            onSubmitSuccess?.({
              createdEvaluator: {
                id: createdEvaluator.id,
                name: createdEvaluator.name,
              },
              datasetEvaluatorId: createdId,
            });
            notifySuccess({
              title: "Evaluator created",
              message: "The code evaluator has been added to the dataset.",
            });
            onDirtyChange?.(false);
            onClose();
          },
          onError: (mutationError) => {
            const flattened =
              getErrorMessagesFromRelayMutationError(mutationError)?.join(
                "\n"
              ) ?? mutationError.message;
            setError(flattened);
            onSubmitError?.(flattened);
          },
        });
      },
      onError: (mutationError) => {
        const flattened =
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
          mutationError.message;
        setError(flattened);
        onSubmitError?.(flattened);
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
          initialLanguage={initialLanguage}
          initialSourceCode={initialSourceCode}
          sandboxConfigs={sandboxConfigs}
          initialSandboxConfigId={initialSandboxConfigId}
        />
      )}
    </EvaluatorStoreProvider>
  );
};
