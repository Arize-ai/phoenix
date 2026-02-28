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
import type { EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery.graphql";
import type { EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation.graphql";
import { EditCodeEvaluatorDialogContent } from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { useNotifySuccess } from "@phoenix/contexts";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES,
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
  onUpdate?: () => void;
} & ModalOverlayProps;

export function EditCodeDatasetEvaluatorSlideover({
  datasetEvaluatorId,
  datasetId,
  onUpdate,
  ...props
}: EditCodeDatasetEvaluatorSlideoverProps) {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Edit code evaluator">
          {({ close }) => (
            <Suspense
              fallback={
                <Flex flex={1} alignItems="center">
                  <Loading />
                </Flex>
              }
            >
              {datasetEvaluatorId && (
                <EvaluatorPlaygroundProvider>
                  <EditCodeDatasetEvaluatorSlideoverContent
                    datasetEvaluatorId={datasetEvaluatorId}
                    onClose={close}
                    datasetId={datasetId}
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

function EditCodeDatasetEvaluatorSlideoverContent({
  datasetEvaluatorId,
  onClose,
  datasetId,
  onUpdate,
}: {
  datasetEvaluatorId: string;
  onClose: () => void;
  datasetId: string;
  onUpdate?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);

  const { dataset } =
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
                outputConfigs {
                  ... on CategoricalAnnotationConfig {
                    name
                    annotationType
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    annotationType
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
                  ... on CodeEvaluator {
                    sourceCode
                    language
                    inputSchema
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
  const evaluator = datasetEvaluator.evaluator;
  invariant(evaluator, "evaluator is required");

  const [updateCodeEvaluator, isUpdating] =
    useMutation<EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation>(
      graphql`
        mutation EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation(
          $input: UpdateCodeEvaluatorInput!
        ) {
          updateCodeEvaluator(input: $input) {
            evaluator {
              id
              name
              sourceCode
              language
            }
          }
        }
      `
    );

  const initialState = useMemo(() => {
    const outputConfigs = (datasetEvaluator.outputConfigs ?? []) as Mutable<
      | ContinuousEvaluatorAnnotationConfig
      | ClassificationEvaluatorAnnotationConfig
    >[];
    return {
      ...DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES,
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
        ...DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES.evaluator,
        id: evaluator.id,
        globalName: evaluator.name ?? "",
        name: datasetEvaluator.name ?? "",
        description:
          datasetEvaluator.description ?? evaluator.description ?? "",
        kind: "CODE" as const,
        isBuiltin: false,
        inputMapping:
          datasetEvaluator.inputMapping ??
          DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES.evaluator.inputMapping,
      },
      sourceCode:
        evaluator.sourceCode ??
        DEFAULT_USER_CODE_EVALUATOR_STORE_VALUES.sourceCode,
      language: "PYTHON" as const,
      outputConfigs,
    } satisfies EvaluatorStoreProps;
  }, [datasetEvaluator, evaluator, datasetId, datasetEvaluatorId]);

  const onSubmit = (store: EvaluatorStoreInstance) => {
    setError(undefined);
    const {
      evaluator: { name, description, inputMapping },
      sourceCode,
      language,
      outputConfigs,
    } = store.getState();

    const normalizedDescription = description.trim() || null;

    updateCodeEvaluator({
      variables: {
        input: {
          evaluatorId: evaluator.id,
          name,
          sourceCode,
          language,
          inputMapping,
          outputConfigs: buildOutputConfigsInput(outputConfigs),
          description: normalizedDescription,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Code evaluator updated",
        });
        onClose();
        onUpdate?.();
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
        <EditCodeEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isUpdating}
          mode="update"
          error={error}
          evaluatorInputSchema={evaluator.inputSchema}
        />
      )}
    </EvaluatorStoreProvider>
  );
}
