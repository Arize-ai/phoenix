import { Suspense, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import { Dialog, DialogContent, Flex, Loading } from "@phoenix/components";
import type { CreateBuiltInDatasetEvaluatorSlideover_AssignEvaluatorToDatasetMutation } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_AssignEvaluatorToDatasetMutation.graphql";
import type { CreateBuiltInDatasetEvaluatorSlideover_dataset$key } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_dataset.graphql";
import type { CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import { EditBuiltInEvaluatorDialogContent } from "@phoenix/components/evaluators/EditBuiltInEvaluatorDialogContent";
import {
  DEFAULT_CODE_FORM_VALUES,
  EvaluatorFormValues,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { useNotifySuccess } from "@phoenix/contexts";
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

  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    dataset.id,
    "DatasetEvaluatorsTable_datasetEvaluators"
  );
  const [assignEvaluatorToDataset, isAssigningEvaluatorToDataset] =
    useMutation<CreateBuiltInDatasetEvaluatorSlideover_AssignEvaluatorToDatasetMutation>(
      graphql`
        mutation CreateBuiltInDatasetEvaluatorSlideover_AssignEvaluatorToDatasetMutation(
          $input: AssignEvaluatorToDatasetInput!
          $connectionIds: [ID!]!
        ) {
          assignEvaluatorToDataset(input: $input) {
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
  const defaultFormValues: EvaluatorFormValues | null = useMemo(() => {
    if (evaluator.kind === "CODE") {
      return {
        ...DEFAULT_CODE_FORM_VALUES,
        dataset: {
          readonly: true,
          id: datasetId,
          assignEvaluatorToDataset: true,
        },
        evaluator: {
          ...DEFAULT_CODE_FORM_VALUES.evaluator,
          name: evaluator.name?.toLowerCase().replace(/\s+/g, "_") ?? "",
          description: evaluator.description ?? "",
          kind: evaluator.kind,
          isBuiltin: true,
          builtInEvaluatorName: evaluator.name,
        },
      };
    }
    return null;
  }, [evaluator, datasetId]);

  if (!defaultFormValues) {
    throw new Error(
      `EvaluatorConfigDialogContent: unexpected evaluator kind: ${evaluator?.kind}`
    );
  }

  const form = useForm<EvaluatorFormValues>({
    mode: "onChange",
    defaultValues: defaultFormValues,
  });
  const {
    getValues,
    formState: { isValid: isFormValid },
  } = form;

  const onAddEvaluator = () => {
    if (!isFormValid) {
      return;
    }
    setError(undefined);
    const {
      inputMapping,
      evaluator: { name },
    } = getValues();
    assignEvaluatorToDataset({
      variables: {
        input: {
          datasetId: dataset.id,
          evaluatorId: evaluator.id,
          displayName: name,
          inputMapping,
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
    <FormProvider {...form}>
      <EditBuiltInEvaluatorDialogContent
        onClose={onClose}
        evaluatorInputSchema={evaluator.inputSchema}
        onSubmit={onAddEvaluator}
        isSubmitting={isAssigningEvaluatorToDataset}
        mode="create"
        error={error}
      />
    </FormProvider>
  );
}
