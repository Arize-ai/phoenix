import { Suspense, useMemo, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { FormProvider, useForm } from "react-hook-form";
import {
  ConnectionHandler,
  graphql,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
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
import {
  DEFAULT_CODE_FORM_VALUES,
  EvaluatorFormValues,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EditBuiltInDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string | null;
  datasetId: string;
  updateConnectionIds?: string[];
} & ModalOverlayProps;

export function EditBuiltInDatasetEvaluatorSlideover({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
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
                <EditBuiltInDatasetEvaluatorSlideoverContent
                  datasetEvaluatorId={datasetEvaluatorId}
                  onClose={close}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                />
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
}: {
  datasetEvaluatorId: string;
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
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
                ... on DatasetEvaluator {
                  displayName
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
  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    dataset.id,
    "DatasetEvaluatorsTable_datasetEvaluators"
  );
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
            }
          }
        }
      `
    );
  const evaluator = datasetEvaluator.evaluator;
  invariant(evaluator, "evaluator is required");
  const displayName = datasetEvaluator.displayName;
  const inputMapping = datasetEvaluator.inputMapping;
  const evaluatorKind = evaluator.kind;
  const evaluatorName = evaluator.name;
  const evaluatorDescription = evaluator.description;
  const defaultFormValues: EvaluatorFormValues | null = useMemo(() => {
    if (evaluatorKind === "CODE") {
      return {
        ...DEFAULT_CODE_FORM_VALUES,
        dataset: {
          readonly: true,
          id: datasetId,
          assignEvaluatorToDataset: true,
        },
        evaluator: {
          ...DEFAULT_CODE_FORM_VALUES.evaluator,
          name: displayName ?? "",
          description: evaluatorDescription ?? "",
          kind: evaluatorKind,
          isBuiltin: true,
          builtInEvaluatorName: evaluatorName,
        },
        inputMapping: inputMapping
          ? // deep clone the input mapping to ensure relay doesn't mutate the original object
            // TODO: remove this once we are using zustand
            structuredClone(inputMapping)
          : {
              literalMapping: {},
              pathMapping: {},
            },
      };
    }
    return null;
  }, [
    datasetId,
    displayName,
    evaluatorKind,
    evaluatorName,
    inputMapping,
    evaluatorDescription,
  ]);

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
    updateDatasetBuiltinEvaluator({
      variables: {
        input: {
          datasetEvaluatorId: datasetEvaluatorId,
          displayName: name,
          // deep clone the input mapping to ensure relay doesn't mutate the original object
          // TODO: remove this once we are using zustand
          inputMapping: structuredClone(inputMapping),
        },
        connectionIds: [
          datasetEvaluatorsTableConnection,
          ...(updateConnectionIds ?? []),
        ],
      },
      onCompleted: () => {
        notifySuccess({
          title: "Evaluator updated",
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
        isSubmitting={isUpdatingDatasetBuiltinEvaluator}
        mode="update"
        error={error}
      />
    </FormProvider>
  );
}
