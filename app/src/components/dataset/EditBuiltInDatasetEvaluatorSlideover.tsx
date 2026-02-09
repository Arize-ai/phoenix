import { Suspense, useMemo, useState } from "react";
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
import type { EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery } from "@phoenix/components/dataset/__generated__/EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery.graphql";
import { EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation.graphql";
import { EditBuiltInEvaluatorDialogContent } from "@phoenix/components/evaluators/EditBuiltInEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { useNotifySuccess } from "@phoenix/contexts";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_CODE_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
} from "@phoenix/types";
import type { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditBuiltInDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string | null;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
} & ModalOverlayProps;

export function EditBuiltInDatasetEvaluatorSlideover({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  ...props
}: EditBuiltInDatasetEvaluatorSlideoverProps) {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Edit built-in evaluator on dataset">
          {({ close }) => (
            <Suspense
              fallback={
                <Flex flex={1} alignItems="center">
                  <Loading />
                </Flex>
              }
            >
              {datasetEvaluatorId && (
                // TODO: remove playground provider
                <EvaluatorPlaygroundProvider>
                  <EditBuiltInDatasetEvaluatorSlideoverContent
                    datasetEvaluatorId={datasetEvaluatorId}
                    onClose={close}
                    datasetId={datasetId}
                    updateConnectionIds={updateConnectionIds}
                    onUpdate={onUpdate}
                  />
                </EvaluatorPlaygroundProvider>
              )}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function EditBuiltInDatasetEvaluatorSlideoverContent({
  datasetEvaluatorId,
  onClose,
  datasetId,
  updateConnectionIds,
  onUpdate,
}: {
  datasetEvaluatorId: string;
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const { dataset } =
    useLazyLoadQuery<EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery>(
      graphql`
        query EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery(
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
                ... on DatasetEvaluator {
                  outputConfigs {
                    ... on EmbeddedCategoricalAnnotationConfig {
                      name
                      optimizationDirection
                      values {
                        label
                        score
                      }
                    }
                    ... on EmbeddedContinuousAnnotationConfig {
                      name
                      optimizationDirection
                      lowerBound
                      upperBound
                    }
                  }
                  inputMapping {
                    literalMapping
                    pathMapping
                  }
                  evaluator {
                    id
                    name
                    kind
                    description
                    ... on BuiltInEvaluator {
                      inputSchema
                      outputConfigs {
                        ... on EmbeddedCategoricalAnnotationConfig {
                          name
                          optimizationDirection
                          values {
                            label
                            score
                          }
                        }
                        ... on EmbeddedContinuousAnnotationConfig {
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
          }
        }
      `,
      { datasetEvaluatorId, datasetId },
      { fetchPolicy: "network-only" }
    );
  invariant(dataset, "dataset is required");
  const datasetEvaluator = dataset.datasetEvaluator;
  invariant(datasetEvaluator, "datasetEvaluator is required");

  const [updateDatasetBuiltinEvaluator, isUpdatingDatasetBuiltinEvaluator] =
    useMutation<EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation>(
      graphql`
        mutation EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation(
          $input: UpdateDatasetBuiltinEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          updateDatasetBuiltinEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              ...DatasetEvaluatorsTable_row
              ...PlaygroundDatasetSection_evaluator
              ...BuiltInDatasetEvaluatorDetails_datasetEvaluator
            }
          }
        }
      `
    );
  const evaluator = datasetEvaluator.evaluator;
  invariant(evaluator, "evaluator is required");
  const name = datasetEvaluator.name;
  const inputMapping = datasetEvaluator.inputMapping;
  const evaluatorKind = evaluator.kind;
  const evaluatorGlobalName = evaluator.name;
  const evaluatorDescription = datasetEvaluator.description;
  const evaluatorId = evaluator.id;
  // Load all output configs from the evaluator data, falling back to evaluator's defaults
  const loadedOutputConfigs = (
    datasetEvaluator.outputConfigs?.length
      ? datasetEvaluator.outputConfigs
      : evaluator.outputConfigs
  ) as
    | Mutable<
        | ContinuousEvaluatorAnnotationConfig
        | ClassificationEvaluatorAnnotationConfig
      >[]
    | undefined;
  const initialState = useMemo(() => {
    if (evaluatorKind === "BUILTIN") {
      return {
        ...DEFAULT_CODE_EVALUATOR_STORE_VALUES,
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
        datasetEvaluator: {
          id: datasetEvaluatorId,
        },
        evaluator: {
          ...DEFAULT_CODE_EVALUATOR_STORE_VALUES.evaluator,
          id: evaluatorId,
          globalName: evaluatorGlobalName ?? "",
          name: name ?? "",
          description: evaluatorDescription ?? "",
          kind: evaluatorKind,
          isBuiltin: true,
          inputMapping,
        },
        outputConfigs: loadedOutputConfigs ?? [],
      } satisfies EvaluatorStoreProps;
    }
    return null;
  }, [
    datasetId,
    name,
    evaluatorKind,
    evaluatorGlobalName,
    evaluatorId,
    inputMapping,
    datasetEvaluatorId,
    evaluatorDescription,
    loadedOutputConfigs,
  ]);

  if (!initialState) {
    throw new Error(
      `EvaluatorConfigDialogContent: unexpected evaluator kind: ${evaluator?.kind}`
    );
  }

  const onAddEvaluator = (store: EvaluatorStoreInstance) => {
    setError(undefined);
    const {
      evaluator: { inputMapping, name, description },
      outputConfigs,
    } = store.getState();

    const normalizedDescription = description.trim();

    updateDatasetBuiltinEvaluator({
      variables: {
        input: {
          datasetEvaluatorId: datasetEvaluatorId,
          name,
          inputMapping,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          description: normalizedDescription,
        },
        connectionIds: updateConnectionIds ?? [],
      },
      onCompleted: () => {
        notifySuccess({
          title: "Evaluator updated",
        });
        onClose();
        if (onUpdate) {
          onUpdate();
        }
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
        <EditBuiltInEvaluatorDialogContent
          onClose={onClose}
          evaluatorInputSchema={evaluator.inputSchema}
          onSubmit={() => onAddEvaluator(store)}
          isSubmitting={isUpdatingDatasetBuiltinEvaluator}
          mode="update"
          error={error}
        />
      )}
    </EvaluatorStoreProvider>
  );
}
