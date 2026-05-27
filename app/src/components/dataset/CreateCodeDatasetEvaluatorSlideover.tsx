import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Slideover that authors a new code evaluator and binds it to a dataset.
 *
 * Two callers:
 * - `AddEvaluatorMenu` mounts it with no `initialSnapshot` / `on*` callbacks,
 *   keeping the original manual-add UX (notifySuccess + close on Save).
 * - `DatasetEvaluatorsPage` mounts a second instance driven by a pending
 *   `create_code_evaluator` proposal — `initialSnapshot` seeds the form from
 *   the agent's proposal and `onSubmitSuccess` / `onSubmitError` / `onCancel`
 *   drive the proposal's terminal resolvers so the chat-side tool call resolves.
 */
export const CreateCodeDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  onOpenChange,
  isOpen,
  initialSnapshot,
  onSubmitSuccess,
  onSubmitError,
  onCancel,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  /**
   * When provided, seed the form from this snapshot (agent-handoff path).
   * Otherwise the form opens with defaults (manual-add path).
   */
  initialSnapshot?: CodeEvaluatorDraftSnapshot | null;
  /** Fires after both create mutations complete (handoff path). */
  onSubmitSuccess?: (
    datasetEvaluatorId: string,
    createdEvaluator: { id: string; name: string }
  ) => void;
  /** Fires when either mutation surfaces a server-side error (handoff path). */
  onSubmitError?: (message: string) => void;
  /** Fires when the slideover closes without committing (handoff path). */
  onCancel?: () => void;
} & ModalOverlayProps) => {
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isDirtyRef.current = false;
    }
  }, [isOpen]);

  // Distinguishes a user-driven close (which should drive onCancel for the
  // handoff caller) from a programmatic close after a successful Save.
  const submittedRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      submittedRef.current = false;
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
      if (!nextIsOpen && !submittedRef.current) {
        onCancel?.();
      }
      onOpenChange?.(nextIsOpen);
    },
    [onCancel, onOpenChange]
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
                initialSnapshot={initialSnapshot ?? null}
                onSubmitSuccess={onSubmitSuccess}
                onSubmitError={onSubmitError}
                markSubmitted={() => {
                  submittedRef.current = true;
                }}
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
  initialSnapshot,
  onSubmitSuccess,
  onSubmitError,
  markSubmitted,
}: {
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  initialSnapshot: CodeEvaluatorDraftSnapshot | null;
  onSubmitSuccess?: (
    datasetEvaluatorId: string,
    createdEvaluator: { id: string; name: string }
  ) => void;
  onSubmitError?: (message: string) => void;
  markSubmitted: () => void;
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
    const seededOutputConfigs = initialSnapshot
      ? initialSnapshot.outputConfigs.map(fromOutputConfigDraft)
      : [createDefaultFreeformOutputConfig("")];
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
      outputConfigs: seededOutputConfigs,
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
  const initialSandboxConfigId: string | null =
    initialSnapshot?.sandboxConfigId ?? null;

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
            if (onSubmitSuccess) {
              onSubmitSuccess(createdId, {
                id: createdEvaluator.id,
                name: createdEvaluator.name,
              });
            } else {
              notifySuccess({
                title: "Evaluator created",
                message: "The code evaluator has been added to the dataset.",
              });
            }
            onDirtyChange?.(false);
            markSubmitted();
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
