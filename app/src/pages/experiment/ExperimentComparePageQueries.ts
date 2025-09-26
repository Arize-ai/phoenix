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

export const ExperimentComparePageQueriesSelectedCompareExperimentsQuery = graphql`
  query ExperimentComparePageQueriesSelectedCompareExperimentsQuery(
    $datasetId: ID!
    $experimentIds: [ID!]!
  ) {
    ...ExperimentComparePage_selectedCompareExperiments
      @arguments(datasetId: $datasetId, experimentIds: $experimentIds)
  }
`;
