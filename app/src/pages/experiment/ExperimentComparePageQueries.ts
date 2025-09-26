import { graphql } from "react-relay";

export const ExperimentComparePageQueriesMultiSelectorQuery = graphql`
  query ExperimentComparePageQueriesMultiSelectorQuery(
    $datasetId: ID!
    $hasBaseExperiment: Boolean!
    $baseExperimentId: ID!
  ) {
    ...ExperimentMultiSelector__data
      @arguments(
        datasetId: $datasetId
        hasBaseExperiment: $hasBaseExperiment
        baseExperimentId: $baseExperimentId
      )
  }
`;
