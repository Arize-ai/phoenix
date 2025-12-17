import { Suspense, useMemo, useState } from "react";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import { Dialog, DialogContent, Flex, Loading } from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation.graphql";
import type { CreateBuiltInDatasetEvaluatorSlideover_dataset$key } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_dataset.graphql";
import type { CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import { EditBuiltInEvaluatorDialogContent } from "@phoenix/components/evaluators/EditBuiltInEvaluatorDialogContent";
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
  onClose,
  onEvaluatorAssigned,
  datasetRef,
}: {
  evaluatorId: string | null;
  onClose: () => void;
  onEvaluatorAssigned?: () => void;
  datasetRef: CreateBuiltInDatasetEvaluatorSlideover_dataset$key;
}) {
  return (
    <Dialog aria-label="Add evaluator to dataset">
      <DialogContent minHeight="300px">
        <Suspense
          fallback={
            <Flex flex={1} alignItems="center">
              <Loading />
            </Flex>
          }
        >
          {evaluatorId && (
            <CreateBuiltInDatasetEvaluatorSlideoverContent
              evaluatorId={evaluatorId}
              onClose={onClose}
              onEvaluatorAssigned={onEvaluatorAssigned}
              datasetRef={datasetRef}
            />
          )}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function CreateBuiltInDatasetEvaluatorSlideoverContent({
  evaluatorId,
  onClose,
  onEvaluatorAssigned,
  datasetRef,
}: {
  evaluatorId: string;
  onClose: () => void;
  onEvaluatorAssigned?: () => void;
  datasetRef: CreateBuiltInDatasetEvaluatorSlideover_dataset$key;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const dataset =
    useFragment<CreateBuiltInDatasetEvaluatorSlideover_dataset$key>(
      graphql`
        fragment CreateBuiltInDatasetEvaluatorSlideover_dataset on Dataset {
          id
          name
        }
      `,
      datasetRef
    );

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
    dataset.id,
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

  const datasetId = dataset.id;
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
          datasetId: dataset.id,
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
