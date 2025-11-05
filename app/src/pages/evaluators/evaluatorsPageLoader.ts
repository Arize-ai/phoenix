import { graphql, loadQuery } from "react-relay";

import { evaluatorsPageLoaderQuery } from "@phoenix/pages/evaluators/__generated__/evaluatorsPageLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const evaluatorsPageLoaderGql = graphql`
  query evaluatorsPageLoaderQuery {
    ...EvaluatorsTable_evaluators
  }
`;

export const evaluatorsPageLoader = () => {
  return loadQuery<evaluatorsPageLoaderQuery>(
    RelayEnvironment,
    evaluatorsPageLoaderGql,
    {}
  );
};

export type EvaluatorsPageLoaderType = ReturnType<typeof evaluatorsPageLoader>;
