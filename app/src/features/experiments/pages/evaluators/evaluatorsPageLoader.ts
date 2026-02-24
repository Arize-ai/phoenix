import { graphql, loadQuery } from "react-relay";

import type { evaluatorsPageLoaderQuery } from "@phoenix/features/experiments/pages/evaluators/__generated__/evaluatorsPageLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const evaluatorsPageLoaderGql = graphql`
  query evaluatorsPageLoaderQuery {
    ...GlobalEvaluatorsTable_evaluators
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
