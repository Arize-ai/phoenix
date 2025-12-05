import { graphql, loadQuery } from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetEvaluatorsLoaderQuery } from "./__generated__/datasetEvaluatorsLoaderQuery.graphql";

export const datasetEvaluatorsLoaderGQL = graphql`
  query datasetEvaluatorsLoaderQuery($id: ID!) {
    dataset: node(id: $id) {
      id
      ... on Dataset {
        id
        ...EvaluatorConfigDialog_dataset
        ...DatasetEvaluatorsTable_evaluators
      }
    }
    ...AddEvaluatorMenu_query @arguments(datasetId: $id)
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
    { id: datasetId }
  );
}
