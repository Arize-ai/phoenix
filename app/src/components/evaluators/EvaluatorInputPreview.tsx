import { Suspense, useEffect, useEffectEvent, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Loading } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { EvaluatorInputPreviewContentQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorInputPreviewContentQuery.graphql";
import {
  datasetExampleToEvaluatorInput,
  EMPTY_EVALUATOR_INPUT_STRING,
} from "@phoenix/components/evaluators/utils";

type EvaluatorInputPreviewProps = {
  datasetId?: string | null;
  splitIds?: string[];
  exampleId?: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
  hypotheticalTaskOutput?: string | null;
};

/**
 * Given a datasetId, splitIds, and optional exampleId, this component will
 * fetch the dataset with splits, and then show the first example or the example chosen.
 *
 * It will display the hypothetical input for the evaluator, given the dataset example.
 */
export const EvaluatorInputPreview = ({
  datasetId,
  splitIds,
  exampleId,
  onSelectExampleId,
}: EvaluatorInputPreviewProps) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        max-height: 400px;
        min-height: 100px;
        overflow-y: auto;
        border-radius: var(--ac-global-rounding-medium);
        background-color: var(--ac-global-input-field-background-color);
      `}
    >
      <Suspense fallback={<Loading />}>
        <EvaluatorInputPreviewContent
          datasetId={datasetId}
          splitIds={splitIds}
          exampleId={exampleId}
          onSelectExampleId={onSelectExampleId}
        />
      </Suspense>
    </div>
  );
};

const EvaluatorInputPreviewContent = ({
  datasetId,
  splitIds,
  exampleId,
  onSelectExampleId: _onSelectExampleId,
}: {
  datasetId?: string | null;
  splitIds?: string[];
  exampleId?: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
}) => {
  const data = useLazyLoadQuery<EvaluatorInputPreviewContentQuery>(
    graphql`
      query EvaluatorInputPreviewContentQuery(
        $datasetId: ID!
        $splitIds: [ID!]
        $hasDataset: Boolean!
      ) {
        dataset: node(id: $datasetId) @include(if: $hasDataset) {
          ... on Dataset {
            examples(splitIds: $splitIds) {
              edges {
                example: node {
                  id
                  revision {
                    ...utils_datasetExampleToEvaluatorInput_example
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId: datasetId ?? "", splitIds, hasDataset: datasetId != null }
  );
  const example = useMemo(() => {
    if (!data.dataset) {
      return null;
    }
    if (!exampleId) {
      return data.dataset.examples?.edges[0]?.example;
    }
    return data.dataset.examples?.edges.find(
      (edge) => edge.example.id === exampleId
    )?.example;
  }, [data, exampleId]);
  const onSelectExampleId = useEffectEvent(_onSelectExampleId);
  useEffect(() => {
    onSelectExampleId(example?.id ?? null);
    // These can be removed once the rules of hooks plugin is updated to support useEffectEvent
  }, [example]);
  const value = useMemo(() => {
    if (!example) {
      return EMPTY_EVALUATOR_INPUT_STRING;
    }
    try {
      const evaluatorInput = datasetExampleToEvaluatorInput({
        exampleRef: example.revision,
      });
      return JSON.stringify(evaluatorInput, null, 2);
    } catch {
      return EMPTY_EVALUATOR_INPUT_STRING;
    }
  }, [example]);
  return <JSONBlock value={value} />;
};
