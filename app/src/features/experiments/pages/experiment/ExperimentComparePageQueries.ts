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

export const ExperimentComparePageQueriesCompareGridQuery = graphql`
  query ExperimentComparePageQueriesCompareGridQuery(
    $datasetId: ID!
    $experimentIds: [ID!]!
    $baseExperimentId: ID!
    $compareExperimentIds: [ID!]!
  ) {
    ...ExperimentCompareTable_comparisons
      @arguments(
        datasetId: $datasetId
        experimentIds: $experimentIds
        baseExperimentId: $baseExperimentId
        compareExperimentIds: $compareExperimentIds
      )
  }
`;

export const ExperimentComparePageQueriesCompareListQuery = graphql`
  query ExperimentComparePageQueriesCompareListQuery(
    $datasetId: ID!
    $baseExperimentId: ID!
    $compareExperimentIds: [ID!]!
    $experimentIds: [ID!]!
  ) {
    ...ExperimentCompareListPage_comparisons
      @arguments(
        baseExperimentId: $baseExperimentId
        compareExperimentIds: $compareExperimentIds
      )
    ...ExperimentCompareListPage_aggregateData
      @arguments(datasetId: $datasetId, experimentIds: $experimentIds)
  }
`;

export const ExperimentComparePageQueriesCompareMetricsQuery = graphql`
  query ExperimentComparePageQueriesCompareMetricsQuery(
    $datasetId: ID!
    $baseExperimentId: ID!
    $compareExperimentIds: [ID!]!
    $experimentIds: [ID!]!
    $hasCompareExperiments: Boolean!
  ) {
    ...ExperimentCompareMetricsPage_experiments
      @arguments(
        datasetId: $datasetId
        baseExperimentId: $baseExperimentId
        compareExperimentIds: $compareExperimentIds
        experimentIds: $experimentIds
        hasCompareExperiments: $hasCompareExperiments
      )
  }
`;
