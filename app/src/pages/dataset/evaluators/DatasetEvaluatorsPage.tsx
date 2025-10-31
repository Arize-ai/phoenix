import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, View } from "@phoenix/components";
import { EvaluatorSelect } from "@phoenix/components/evaluators/EvaluatorSelect";

import { DatasetEvaluatorsPageQuery } from "./__generated__/DatasetEvaluatorsPageQuery.graphql";

export function DatasetEvaluatorsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");

  const data = useLazyLoadQuery<DatasetEvaluatorsPageQuery>(
    graphql`
      query DatasetEvaluatorsPageQuery($datasetId: ID!) {
        evaluators(first: 100) {
          edges {
            node {
              id
              name
              kind
              isAssignedToDataset(datasetId: $datasetId)
            }
          }
        }
      }
    `,
    {
      datasetId,
    }
  );

  console.log("evaluators", data.evaluators.edges);

  const evaluators = data.evaluators.edges.map((edge) => ({
    id: edge.node.id,
    name: edge.node.name,
    kind: edge.node.kind as "CODE" | "LLM",
    alreadyAdded: edge.node.isAssignedToDataset,
  }));

  return (
    <main>
      <View padding="size-200">
        <Flex direction="row" gap="size-200" justifyContent="end">
          <EvaluatorSelect
            evaluators={evaluators}
            onSelectionChange={(evaluatorId) => {
              console.log("adding evaluator", evaluatorId);
            }}
            addNewEvaluatorLink="/evaluators/new"
            selectionMode="single"
          />
        </Flex>
      </View>
    </main>
  );
}
