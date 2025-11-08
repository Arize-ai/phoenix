import { Suspense, useEffect, useEffectEvent, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Loading, Text } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { EvaluatorDatasetExamplePreviewContentQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorDatasetExamplePreviewContentQuery.graphql";

type EvaluatorDatasetExamplePreviewProps = {
  datasetId?: string | null;
  splitIds?: string[];
  exampleId?: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
};

/**
 * Given a datasetId, splitIds, and optional exampleId, this component will
 * fetch the dataset with splits, and then show the first example or the example chosen.
 *
 * It will display the example in a JSON block, providing a fallback if no dataset is selected or the example is not found.
 */
export const EvaluatorDatasetExamplePreview = ({
  datasetId,
  splitIds,
  exampleId,
  onSelectExampleId,
}: EvaluatorDatasetExamplePreviewProps) => {
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
      {datasetId ? (
        <Suspense fallback={<Loading />}>
          <EvaluatorDatasetExamplePreviewContent
            datasetId={datasetId}
            splitIds={splitIds}
            exampleId={exampleId}
            onSelectExampleId={onSelectExampleId}
          />
        </Suspense>
      ) : (
        <EvaluatorDatasetExampleEmpty />
      )}
    </div>
  );
};

const EvaluatorDatasetExampleEmpty = () => {
  return (
    <Flex justifyContent="center" alignItems="center" flex={1}>
      <Text color="text-500">No dataset selected</Text>
    </Flex>
  );
};

const EvaluatorDatasetExamplePreviewContent = ({
  datasetId,
  splitIds,
  exampleId,
  onSelectExampleId: _onSelectExampleId,
}: {
  datasetId: string;
  splitIds?: string[];
  exampleId?: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
}) => {
  const data = useLazyLoadQuery<EvaluatorDatasetExamplePreviewContentQuery>(
    graphql`
      query EvaluatorDatasetExamplePreviewContentQuery(
        $datasetId: ID!
        $splitIds: [ID!]
      ) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            examples(splitIds: $splitIds) {
              edges {
                example: node {
                  id
                  revision {
                    input
                    output
                    metadata
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId, splitIds }
  );
  const example = useMemo(() => {
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
    try {
      return JSON.stringify(example?.revision, null, 2);
    } catch {
      return null;
    }
  }, [example]);
  if (!value) {
    return <EvaluatorDatasetExampleEmpty />;
  }
  return <JSONBlock value={value} />;
};
