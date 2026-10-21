import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_STORE_VALUES,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

import type { EditDecisionDatasetEvaluatorSlideover_evaluatorQuery } from "./__generated__/EditDecisionDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import { DecisionDatasetEvaluatorForm } from "./DecisionDatasetEvaluatorForm";

type EditDecisionDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
} & Omit<ViewportModalOverlayProps, "children">;

export const EditDecisionDatasetEvaluatorSlideover = ({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  ...props
}: EditDecisionDatasetEvaluatorSlideoverProps) => {
  return (
    <ViewportModalOverlay {...props}>
      <ViewportModal size="fullscreen">
        <Dialog aria-label="Edit decision evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {!!datasetEvaluatorId && (
                <EditDecisionEvaluatorDialog
                  datasetEvaluatorId={datasetEvaluatorId}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onClose={close}
                  onUpdate={onUpdate}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
};

type EditDecisionEvaluatorDialogProps = {
  datasetEvaluatorId: string;
  datasetId: string;
  updateConnectionIds?: string[];
  onClose: () => void;
  onUpdate?: () => void;
};

const EditDecisionEvaluatorDialog = (
  props: EditDecisionEvaluatorDialogProps
) => {
  const { datasetEvaluatorId, datasetId } = props;
  const data =
    useLazyLoadQuery<EditDecisionDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query EditDecisionDatasetEvaluatorSlideover_evaluatorQuery(
          $datasetId: ID!
          $datasetEvaluatorId: ID!
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
                id
                name
                description
                inputMapping {
                  literalMapping
                  pathMapping
                }
                evaluator {
                  __typename
                  id
                  name
                  ... on DecisionEvaluator {
                    inputSchema
                    datasetEvaluators {
                      id
                    }
                    scoringPolicy {
                      questions {
                        __typename
                        name
                        optimizationDirection
                        ... on DecisionPredicateScoring {
                          threshold
                        }
                        ... on DecisionChoiceScoring {
                          scores {
                            choice
                            score
                          }
                        }
                        ... on DecisionScaleScoring {
                          includeLabel
                        }
                      }
                    }
                    decisionVersion {
                      id
                      sequenceNumber
                      decision {
                        id
                        name
                      }
                      questions {
                        __typename
                        ... on DecisionPredicateQuestion {
                          name
                        }
                        ... on DecisionChoiceQuestion {
                          name
                          choices {
                            value
                          }
                        }
                        ... on DecisionScaleQuestion {
                          name
                          levels {
                            label
                          }
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
  const datasetEvaluator = data.dataset.datasetEvaluator;
  invariant(datasetEvaluator != null, "datasetEvaluator is required");
  const evaluator = datasetEvaluator.evaluator;
  invariant(
    evaluator.__typename === "DecisionEvaluator" &&
      evaluator.scoringPolicy &&
      evaluator.decisionVersion,
    "a decision evaluator is required"
  );
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_STORE_VALUES,
        evaluator: {
          ...DEFAULT_STORE_VALUES.evaluator,
          id: evaluator.id,
          globalName: evaluator.name,
          name: datasetEvaluator.name,
          description: datasetEvaluator.description ?? "",
          kind: "DECISION",
          isBuiltin: false,
          inputMapping: {
            literalMapping: {
              ...(datasetEvaluator.inputMapping.literalMapping as Record<
                string,
                never
              >),
            },
            pathMapping: {
              ...(datasetEvaluator.inputMapping.pathMapping as Record<
                string,
                string
              >),
            },
          },
        },
        datasetEvaluator: { id: datasetEvaluatorId },
        outputConfigs: [],
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
      }) satisfies EvaluatorStoreProps,
    [datasetEvaluator, evaluator, datasetEvaluatorId, datasetId]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <DecisionDatasetEvaluatorForm
        {...props}
        initialEvaluator={{
          ...evaluator,
          inputSchema: evaluator.inputSchema,
          scoringPolicy: evaluator.scoringPolicy,
          decisionVersion: evaluator.decisionVersion,
        }}
        otherBindingCount={Math.max(
          0,
          (evaluator.datasetEvaluators?.length ?? 1) - 1
        )}
        onSaved={() => props.onUpdate?.()}
      />
    </EvaluatorStoreProvider>
  );
};
