import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import invariant from "tiny-invariant";

import { Dialog, Empty, Flex, Loading } from "@phoenix/components";
import { EvaluatorAgentChatPanel } from "@phoenix/components/agent/EvaluatorAgentChatPanel";
import { Drawer } from "@phoenix/components/core/overlay/Drawer";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import type { EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation.graphql";
import type { EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery.graphql";
import type { EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation.graphql";
import type { EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation.graphql";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
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
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
} from "@phoenix/types";
import type { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditCodeDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string | null;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function EditCodeDatasetEvaluatorSlideover({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  onOpenChange,
  isOpen,
}: EditCodeDatasetEvaluatorSlideoverProps) {
  const isDirtyRef = useRef(false);
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "edit-code-dataset-evaluator",
  });

  // Reset dirty state when slideover opens
  useEffect(() => {
    if (isOpen) {
      isDirtyRef.current = false;
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isDirtyRef.current) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      defaultSize={defaultSize ?? "80%"}
      minSize="40%"
      maxSize="95%"
      onResize={onSizeChange}
    >
      <Dialog aria-label="Edit code evaluator on dataset">
        {({ close }) => (
          <Group
            orientation="horizontal"
            style={{ height: "100%", overflow: "hidden" }}
          >
            <Panel
              id="evaluator-dialog-content"
              defaultSize="68%"
              minSize="40%"
            >
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
            </Panel>
            <EvaluatorAgentChatPanel />
          </Group>
        )}
      </Dialog>
    </Drawer>
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
            language
            enabled
            configs {
              id
              name
              description
              timeout
              config
            }
          }
          sandboxBackends {
            backendType
            status
            supportsEnvVars
            internetAccess
            dependenciesLanguage
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
    useMutation<EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation>(graphql`
      mutation EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation(
        $input: PatchCodeEvaluatorInput!
      ) {
        patchCodeEvaluator(input: $input) {
          evaluator {
            id
          }
        }
      }
    `);
  const [createCodeEvaluatorVersion, isCreatingCodeEvaluatorVersion] =
    useMutation<EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation>(graphql`
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
    `);
  const [updateDatasetCodeEvaluator, isUpdatingDatasetCodeEvaluator] =
    useMutation<EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation>(graphql`
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
    `);

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
        : [createDefaultContinuousOutputConfig(datasetEvaluator.name ?? "")]
  ) as Mutable<
    | ContinuousEvaluatorAnnotationConfig
    | ClassificationEvaluatorAnnotationConfig
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
      evaluator: { name, description, inputMapping, id: evaluatorId },
      outputConfigs,
    } = store.getState();
    invariant(evaluatorId, "evaluator id is required");
    const normalizedName = name.trim();
    const normalizedDescription = description.trim() || undefined;

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
        />
      )}
    </EvaluatorStoreProvider>
  );
}
