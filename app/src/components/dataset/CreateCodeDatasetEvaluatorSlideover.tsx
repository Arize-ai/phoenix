import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay/ViewportModal";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay/ViewportModal";
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
} & Omit<ViewportModalOverlayProps, "children">) => {
  const isDirtyRef = useRef(false);

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
    <ViewportModalOverlay
      {...props}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    >
      <ViewportModal size="fullscreen">
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
      </ViewportModal>
    </ViewportModalOverlay>
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
  const [createDatasetCodeEvaluator, isCreatingDatasetCodeEvaluator] =
    useMutation<CreateCodeDatasetEvaluatorSlideover_createDatasetCodeEvaluatorMutation>(
      graphql`
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
      `
    );
  const initialState: EvaluatorStoreProps = useMemo(() => {
    return {
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
      outputConfigs: [createDefaultFreeformOutputConfig("")],
      dataset: {
        readonly: true,
        id: datasetId,
        selectedExampleId: null,
        selectedSplitIds: [],
      },
      evaluatorMappingSource: EVALUATOR_MAPPING_SOURCE_DEFAULT,
      showPromptPreview: false,
    };
  }, [datasetId]);

  const initialLanguage = "PYTHON";
  const initialSourceCode = getDefaultCodeEvaluatorSource("PYTHON");
  const initialSandboxConfigId: string | null = null;

  const onSubmit = (
    store: EvaluatorStoreInstance,
    payload: {
      language: "PYTHON" | "TYPESCRIPT";
      sourceCode: string;
      sandboxConfigId?: string | null;
    }
  ): Promise<EvaluatorSubmitResult> => {
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
    const sandboxConfigId = payload.sandboxConfigId;

    return new Promise<EvaluatorSubmitResult>((resolve) => {
      const fail = (mutationError: Error) => {
        const flattened =
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
          mutationError.message;
        setError(flattened);
        resolve({ ok: false, error: flattened });
      };
      createCodeEvaluator({
        variables: {
          input: {
            name: normalizedName,
            description: normalizedDescription,
            sourceCode: payload.sourceCode,
            language: payload.language,
            sandboxConfigId,
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
              notifySuccess({
                title: "Evaluator created",
                message: "The code evaluator has been added to the dataset.",
              });
              onDirtyChange?.(false);
              onClose();
              resolve({
                ok: true,
                acceptedBy: "user",
                evaluator: { id: createdId, name: normalizedName },
              });
            },
            onError: fail,
          });
        },
        onError: fail,
      });
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
