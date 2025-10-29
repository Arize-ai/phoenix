import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Loading, Text } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { EvaluatorDatasetExamplePreviewContentQuery } from "@phoenix/pages/evaluators/__generated__/EvaluatorDatasetExamplePreviewContentQuery.graphql";

type EvaluatorDatasetExamplePreviewProps = {
  datasetId?: string | null;
  splitIds?: string[];
  exampleId?: string | null;
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
}: {
  datasetId: string;
  splitIds?: string[];
  exampleId?: string | null;
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
  const value = useMemo(() => {
    try {
      return JSON.stringify(example?.revision, null, 2);
    } catch (error) {
      return null;
    }
  }, [example]);
  if (!value) {
    return <EvaluatorDatasetExampleEmpty />;
  }
  return <JSONBlock value={value} />;
};
