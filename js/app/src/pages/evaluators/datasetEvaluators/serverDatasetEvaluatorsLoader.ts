import { graphql, loadQuery } from "react-relay";

import type { serverDatasetEvaluatorsLoaderQuery } from "@phoenix/pages/evaluators/datasetEvaluators/__generated__/serverDatasetEvaluatorsLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const serverDatasetEvaluatorsLoaderGql = graphql`
  query serverDatasetEvaluatorsLoaderQuery {
    ...ServerDatasetEvaluatorsTable_datasetEvaluators
  }
`;

export const serverDatasetEvaluatorsLoader = () => {
  return loadQuery<serverDatasetEvaluatorsLoaderQuery>(
    RelayEnvironment,
    serverDatasetEvaluatorsLoaderGql,
    {}
  );
};

export type ServerDatasetEvaluatorsLoaderType = ReturnType<
  typeof serverDatasetEvaluatorsLoader
>;
