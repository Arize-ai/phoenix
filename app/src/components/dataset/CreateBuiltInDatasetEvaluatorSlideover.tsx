import { Suspense, useMemo, useState } from "react";
import { ModalOverlayProps } from "react-aria-components";
import {
  ConnectionHandler,
  graphql,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
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
import { useNotifySuccess } from "@phoenix/contexts";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_CODE_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export function CreateBuiltInDatasetEvaluatorSlideover({
  evaluatorId,
  onEvaluatorAssigned,
  datasetId,
  ...props
}: {
  evaluatorId: string | null;
  onEvaluatorAssigned?: () => void;
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
                      onEvaluatorAssigned={onEvaluatorAssigned}
                      datasetId={datasetId}
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
  onEvaluatorAssigned,
  datasetId,
}: {
  evaluatorId: string;
  onClose: () => void;
  onEvaluatorAssigned?: () => void;
  datasetId: string;
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
            }
          }
        }
      `,
      { evaluatorId }
    );
  invariant(evaluator, "evaluator is required");

  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    datasetId,
    "DatasetEvaluatorsTable_datasetEvaluators"
  );
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
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      `
    );

  const initialState = useMemo(() => {
    invariant(evaluator.name, "evaluator name is required");
    if (evaluator.kind === "CODE") {
      const displayName =
        evaluator.name?.toLowerCase().replace(/\s+/g, "_") ?? "";
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
          name: evaluator.name,
          displayName,
          description: evaluator.description ?? "",
          kind: evaluator.kind,
          isBuiltin: true,
        },
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
      evaluator: { inputMapping, displayName },
    } = store.getState();
    createDatasetBuiltInEvaluator({
      variables: {
        input: {
          datasetId,
          evaluatorId: evaluator.id,
          displayName,
          // deep clone the input mapping to ensure relay doesn't mutate the original object
          // TODO: remove this once we are using zustand
          inputMapping: structuredClone(inputMapping),
        },
        connectionIds: [datasetEvaluatorsTableConnection],
      },
      onCompleted: () => {
        onEvaluatorAssigned?.();
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
