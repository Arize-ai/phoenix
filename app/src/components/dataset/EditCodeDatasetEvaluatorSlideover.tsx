import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  Dialog,
  Empty,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import type { EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation.graphql";
import type { EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery.graphql";
import type { EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation.graphql";
import type { EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation.graphql";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
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
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
  FreeformEvaluatorAnnotationConfig,
} from "@phoenix/types";
import type { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditCodeDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string | null;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
} & ModalOverlayProps;

export function EditCodeDatasetEvaluatorSlideover({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  onOpenChange,
  isOpen,
  ...props
}: EditCodeDatasetEvaluatorSlideoverProps) {
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
        <Dialog aria-label="Edit code evaluator on dataset">
          {({ close }) => (
            <Suspense
              fallback={
                <Flex flex={1} alignItems="center">
                  <Loading />
                </Flex>
              }
            >
              {datasetEvaluatorId && (
                <EditCodeDatasetEvaluatorSlideoverContent
                  datasetEvaluatorId={datasetEvaluatorId}
                  onClose={close}
                  onDirtyChange={handleDirtyChange}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onUpdate={onUpdate}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function EditCodeDatasetEvaluatorSlideoverContent({
  datasetEvaluatorId,
  onClose,
  onDirtyChange,
  datasetId,
  updateConnectionIds,
  onUpdate,
}: {
  datasetEvaluatorId: string;
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>();
  const data =
    useLazyLoadQuery<EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery>(
      graphql`
        query EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery(
          $datasetEvaluatorId: ID!
          $datasetId: ID!
        ) {
          dataset: node(id: $datasetId) {
            id
            ... on Dataset {
              datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
                id
                name
                description
                inputMapping {
                  literalMapping
                  pathMapping
                }
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
                evaluator {
                  id
                  kind
                  ... on CodeEvaluator {
                    name
                    description
                    language
                    sandboxConfig {
                      id
                    }
                    outputConfigs {
                      __typename
                      ... on CategoricalAnnotationConfig {
                        name
                        optimizationDirection
                        values {
                          label
                          score
                        }
                      }
                      ... on ContinuousAnnotationConfig {
                        name
                        optimizationDirection
                        lowerBound
                        upperBound
                      }
                      ... on FreeformAnnotationConfig {
                        name
                        optimizationDirection
                        threshold
                        lowerBound
                        upperBound
                      }
                    }
                    currentVersion {
                      sourceCode
                    }
                  }
                }
              }
            }
          }
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
      { datasetEvaluatorId, datasetId },
      { fetchPolicy: "network-only" }
    );
  const { dataset, sandboxProviders, sandboxBackends } = data;
  invariant(dataset, "dataset is required");
  const datasetEvaluator = dataset.datasetEvaluator;
  invariant(datasetEvaluator, "dataset evaluator is required");
  const evaluator = datasetEvaluator.evaluator;
  invariant(evaluator.kind === "CODE", "expected code evaluator");
  const sandboxConfigs = mapSandboxConfigOptions(
    sandboxProviders,
    sandboxBackends
  );
  const initialSandboxConfigId = evaluator.sandboxConfig?.id ?? null;

  const [patchCodeEvaluator, isPatchingCodeEvaluator] =
    useMutation<EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation>(
      graphql`
        mutation EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation(
          $input: PatchCodeEvaluatorInput!
        ) {
          patchCodeEvaluator(input: $input) {
            evaluator {
              id
            }
          }
        }
      `
    );
  const [createCodeEvaluatorVersion, isCreatingCodeEvaluatorVersion] =
    useMutation<EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation>(
      graphql`
        mutation EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation(
          $input: CreateCodeEvaluatorVersionInput!
        ) {
          createCodeEvaluatorVersion(input: $input) {
            evaluator {
              id
              ... on CodeEvaluator {
                currentVersion {
                  id
                }
              }
            }
          }
        }
      `
    );
  const [updateDatasetCodeEvaluator, isUpdatingDatasetCodeEvaluator] =
    useMutation<EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation>(
      graphql`
        mutation EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation(
          $input: UpdateDatasetCodeEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          updateDatasetCodeEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              ...DatasetEvaluatorsTable_row
              ...PlaygroundDatasetSection_evaluator
              ...CodeDatasetEvaluatorDetails_datasetEvaluator
              id
            }
          }
        }
      `
    );

  // currentVersion is nullable on the schema (a CodeEvaluator can exist
  // without any version: fixtures, backfills, partial-commit recovery.
  // Render a bounded missing-version state instead of throwing.
  const currentVersion = evaluator.currentVersion;
  if (!currentVersion || !currentVersion.sourceCode) {
    return (
      <Flex flex={1} alignItems="center" justifyContent="center">
        <Empty message="This code evaluator has no current version yet." />
      </Flex>
    );
  }
  invariant(evaluator.language, "code evaluator language is required");
  const evaluatorLanguage = evaluator.language;
  const evaluatorSourceCode = currentVersion.sourceCode;

  const loadedOutputConfigs = (
    datasetEvaluator.outputConfigs?.length
      ? datasetEvaluator.outputConfigs
      : evaluator.outputConfigs?.length
        ? evaluator.outputConfigs
        : [createDefaultFreeformOutputConfig(datasetEvaluator.name ?? "")]
  ) as Mutable<
    | ContinuousEvaluatorAnnotationConfig
    | ClassificationEvaluatorAnnotationConfig
    | FreeformEvaluatorAnnotationConfig
  >[];
  const initialState: EvaluatorStoreProps = {
    evaluator: {
      id: evaluator.id,
      globalName: evaluator.name ?? datasetEvaluator.name ?? "",
      name: datasetEvaluator.name ?? evaluator.name ?? "",
      description: datasetEvaluator.description ?? evaluator.description ?? "",
      inputMapping: datasetEvaluator.inputMapping,
      kind: "CODE",
      isBuiltin: false,
      includeExplanation: false,
    },
    datasetEvaluator: {
      id: datasetEvaluatorId,
    },
    outputConfigs: loadedOutputConfigs,
    dataset: {
      readonly: true,
      id: datasetId,
      selectedExampleId: null,
      selectedSplitIds: [],
    },
    evaluatorMappingSourceGrain: "dataset",
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
  ): Promise<EvaluatorSubmitResult> => {
    setError(undefined);
    const {
      evaluator: { name, description, inputMapping, id: evaluatorId },
      outputConfigs,
    } = store.getState();
    invariant(evaluatorId, "evaluator id is required");
    const normalizedName = name.trim();
    const normalizedDescription = description.trim() || undefined;

    return new Promise<EvaluatorSubmitResult>((resolve) => {
      const fail = (mutationError: Error) => {
        const flattened =
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
          mutationError.message;
        setError(flattened);
        resolve({ ok: false, error: flattened });
      };
      // Sandbox rebinding lives exclusively on patchCodeEvaluator; the version
      // row carries no sandbox snapshot.
      patchCodeEvaluator({
        variables: {
          input: {
            id: evaluatorId,
            name: normalizedName,
            description: normalizedDescription,
            outputConfigs: buildOutputConfigsInput(outputConfigs),
            inputMapping,
            ...(payload.sandboxConfigId !== undefined
              ? { sandboxConfigId: payload.sandboxConfigId }
              : {}),
          },
        },
        onCompleted: () => {
          createCodeEvaluatorVersion({
            variables: {
              input: {
                codeEvaluatorId: evaluatorId,
                sourceCode: payload.sourceCode,
              },
            },
            onCompleted: () => {
              updateDatasetCodeEvaluator({
                variables: {
                  input: {
                    datasetEvaluatorId,
                    name: normalizedName,
                    description: normalizedDescription,
                    outputConfigs: buildOutputConfigsInput(outputConfigs),
                    inputMapping,
                  },
                  connectionIds: updateConnectionIds ?? [],
                },
                onCompleted: () => {
                  notifySuccess({ title: "Evaluator updated" });
                  onDirtyChange?.(false);
                  onClose();
                  onUpdate?.();
                  resolve({
                    ok: true,
                    acceptedBy: "user",
                    evaluator: { id: datasetEvaluatorId, name: normalizedName },
                  });
                },
                onError: fail,
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
            isCreatingCodeEvaluatorVersion ||
            isPatchingCodeEvaluator ||
            isUpdatingDatasetCodeEvaluator
          }
          mode="update"
          error={error}
          initialLanguage={evaluatorLanguage}
          initialSourceCode={evaluatorSourceCode}
          sandboxConfigs={sandboxConfigs}
          initialSandboxConfigId={initialSandboxConfigId}
          evaluatorNodeId={evaluator.id}
        />
      )}
    </EvaluatorStoreProvider>
  );
}
