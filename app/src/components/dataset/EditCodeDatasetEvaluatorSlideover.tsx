import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Dialog,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import type { EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery.graphql";
import type { EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation.graphql";
import type { EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_updateDatasetCodeEvaluatorMutation.graphql";
import {
  decodeRelayNodeId,
  mapSandboxConfigOptions,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
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
                    sourceCode
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
            }
          }
          sandboxBackends {
            backendType
            status
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
  invariant(evaluator.language, "code evaluator language is required");
  invariant(evaluator.sourceCode, "code evaluator source code is required");
  const evaluatorLanguage = evaluator.language;
  const evaluatorSourceCode = evaluator.sourceCode;
  const sandboxConfigs = mapSandboxConfigOptions(
    sandboxProviders,
    sandboxBackends
  );
  const sandboxConfigGlobalId = evaluator.sandboxConfig?.id;
  const initialSandboxConfigId = sandboxConfigGlobalId
    ? decodeRelayNodeId(sandboxConfigGlobalId)
    : null;

  const [updateCodeEvaluator, isUpdatingCodeEvaluator] =
    useMutation<EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation>(graphql`
      mutation EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation(
        $input: UpdateCodeEvaluatorInput!
      ) {
        updateCodeEvaluator(input: $input) {
          evaluator {
            id
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
      sandboxConfigId: number | null;
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

    updateCodeEvaluator({
      variables: {
        input: {
          id: evaluatorId,
          name: normalizedName,
          description: normalizedDescription,
          language: payload.language,
          sourceCode: payload.sourceCode,
          sandboxConfigId: payload.sandboxConfigId,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          inputMapping,
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
            isUpdatingCodeEvaluator || isUpdatingDatasetCodeEvaluator
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
