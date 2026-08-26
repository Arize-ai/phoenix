import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import { getEvaluatorCostTimeRange } from "@phoenix/pages/evaluators/evaluatorCostUtils";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetEvaluatorsLoaderQuery } from "./__generated__/datasetEvaluatorsLoaderQuery.graphql";

export const datasetEvaluatorsLoaderGQL = graphql`
  query datasetEvaluatorsLoaderQuery($id: ID!, $costTimeRange: TimeRange) {
    dataset: node(id: $id) {
      id
      ... on Dataset {
        id
        ...DatasetEvaluatorsTable_evaluators
          @arguments(costTimeRange: $costTimeRange)
      }
    }
    ...AddEvaluatorMenu_query
    ...DatasetEvaluatorsPage_builtInEvaluators
  }
`;

/**
 * Loads the data required for the dataset evaluators page
 */
export function datasetEvaluatorsLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  invariant(datasetId, "datasetId is required");
  return loadQuery<datasetEvaluatorsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorsLoaderGQL,
    { id: datasetId, costTimeRange: getEvaluatorCostTimeRange() }
  );
}
