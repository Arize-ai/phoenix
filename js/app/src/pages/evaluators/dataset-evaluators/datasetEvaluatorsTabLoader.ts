import { graphql, loadQuery } from "react-relay";

import type { datasetEvaluatorsTabLoaderQuery } from "@phoenix/pages/evaluators/dataset-evaluators/__generated__/datasetEvaluatorsTabLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const datasetEvaluatorsTabLoaderGql = graphql`
  query datasetEvaluatorsTabLoaderQuery {
    ...DatasetEvaluatorsTabTable_datasetEvaluators
  }
`;

export const datasetEvaluatorsTabLoader = () => {
  return loadQuery<datasetEvaluatorsTabLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorsTabLoaderGql,
    {}
  );
};

export type DatasetEvaluatorsTabLoaderType = ReturnType<
  typeof datasetEvaluatorsTabLoader
>;
