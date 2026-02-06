import { Suspense, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Dialog,
  DialogContent,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation.graphql";
import type { CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery.graphql";
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

export function CreateBuiltInDatasetEvaluatorSlideover({
  evaluatorId,
  updateConnectionIds,
  onEvaluatorCreated,
  datasetId,
  ...props
}: {
  evaluatorId: string | null;
  updateConnectionIds: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  datasetId: string;
} & ModalOverlayProps) {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Add evaluator to dataset">
          {({ close }) => (
            <DialogContent minHeight="300px">
              <Suspense
                fallback={
                  <Flex flex={1} alignItems="center">
                    <Loading />
                  </Flex>
                }
              >
                {evaluatorId && (
                  <EvaluatorPlaygroundProvider>
                    <CreateBuiltInDatasetEvaluatorSlideoverContent
                      evaluatorId={evaluatorId}
                      onClose={close}
                      onEvaluatorCreated={onEvaluatorCreated}
                      datasetId={datasetId}
                      updateConnectionIds={updateConnectionIds}
                    />
                  </EvaluatorPlaygroundProvider>
                )}
              </Suspense>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CreateBuiltInDatasetEvaluatorSlideoverContent({
  evaluatorId,
  onClose,
  onEvaluatorCreated,
  datasetId,
  updateConnectionIds,
}: {
  evaluatorId: string;
  onClose: () => void;
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  datasetId: string;
  updateConnectionIds: string[];
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const { evaluator } =
    useLazyLoadQuery<CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery(
          $evaluatorId: ID!
        ) {
          evaluator: node(id: $evaluatorId) {
            id
            ... on Evaluator {
              name
              kind
              isBuiltin
              description
            }
            ... on BuiltInEvaluator {
              inputSchema
              outputConfigs {
                ... on AnnotationConfigBase {
                  name
                  annotationType
                }
                ... on CategoricalAnnotationConfig {
                  optimizationDirection
                  values {
                    label
                    score
                  }
                }
                ... on ContinuousAnnotationConfig {
                  optimizationDirection
                  lowerBound
                  upperBound
                }
              }
            }
          }
        }
      `,
      { evaluatorId }
    );
  invariant(evaluator, "evaluator is required");

  const [createDatasetBuiltInEvaluator, isCreatingDatasetBuiltInEvaluator] =
    useMutation<CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation>(
      graphql`
        mutation CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation(
          $input: CreateDatasetBuiltinEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createDatasetBuiltinEvaluator(input: $input) {
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

  const initialState = useMemo(() => {
    invariant(evaluator.name, "evaluator name is required");
    if (evaluator.kind === "BUILTIN") {
      const name = evaluator.name;
      // Map all output configs from the evaluator to the store format
      const outputConfigs = (evaluator.outputConfigs ?? []).map(
        (config) =>
          config as Mutable<
            | ContinuousEvaluatorAnnotationConfig
            | ClassificationEvaluatorAnnotationConfig
          >
      );
      return {
        ...DEFAULT_CODE_EVALUATOR_STORE_VALUES,
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
        evaluator: {
          ...DEFAULT_CODE_EVALUATOR_STORE_VALUES.evaluator,
          id: evaluator.id,
          globalName: evaluator.name,
          name,
          description: evaluator.description ?? "",
          kind: evaluator.kind,
          isBuiltin: true,
        },
        // Initialize with all output configs from the evaluator
        outputConfigs,
      } satisfies EvaluatorStoreProps;
    }
    return null;
  }, [evaluator, datasetId]);

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

    createDatasetBuiltInEvaluator({
      variables: {
        input: {
          datasetId,
          evaluatorId: evaluator.id,
          name,
          inputMapping,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          description: normalizedDescription,
        },
        connectionIds: updateConnectionIds,
      },
      onCompleted: (response) => {
        const createdId = response.createDatasetBuiltinEvaluator.evaluator.id;
        onEvaluatorCreated?.(createdId);
        notifySuccess({
          title: "Evaluator created",
          message: "The evaluator has been added to the dataset.",
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
        <EditBuiltInEvaluatorDialogContent
          onClose={onClose}
          evaluatorInputSchema={evaluator.inputSchema}
          onSubmit={() => onAddEvaluator(store)}
          isSubmitting={isCreatingDatasetBuiltInEvaluator}
          mode="create"
          error={error}
        />
      )}
    </EvaluatorStoreProvider>
  );
}
