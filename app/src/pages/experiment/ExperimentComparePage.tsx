import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  graphql,
  PreloadedQuery,
  useFragment,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { useNavigate, useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Alert, Flex, Loading, View } from "@phoenix/components";
import { useExperimentColors } from "@phoenix/components/experiment";
import {
  ExperimentCompareViewMode,
  ExperimentCompareViewModeToggle,
  isExperimentCompareViewMode,
} from "@phoenix/components/experiment/ExperimentCompareViewModeToggle";
import type { ExperimentComparePageQueriesCompareGridQuery as ExperimentComparePageQueriesCompareGridQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareGridQuery.graphql";
import type { ExperimentComparePageQueriesCompareListQuery as ExperimentComparePageQueriesCompareListQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareListQuery.graphql";
import type { ExperimentComparePageQueriesCompareMetricsQuery as ExperimentComparePageQueriesCompareMetricsQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareMetricsQuery.graphql";
import type { ExperimentComparePageQueriesMultiSelectorQuery as ExperimentComparePageQueriesMultiSelectorQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesMultiSelectorQuery.graphql";
import type { ExperimentComparePageQueriesSelectedCompareExperimentsQuery as ExperimentComparePageQueriesSelectedCompareExperimentsQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesSelectedCompareExperimentsQuery.graphql";
import {
  ExperimentComparePageQueriesCompareGridQuery,
  ExperimentComparePageQueriesCompareListQuery,
  ExperimentComparePageQueriesCompareMetricsQuery,
  ExperimentComparePageQueriesMultiSelectorQuery,
  ExperimentComparePageQueriesSelectedCompareExperimentsQuery,
} from "@phoenix/pages/experiment/ExperimentComparePageQueries";
import { ExperimentNameWithColorSwatch } from "@phoenix/pages/experiment/ExperimentNameWithColorSwatch";
import { assertUnreachable } from "@phoenix/typeUtils";

import type {
  ExperimentComparePage_selectedCompareExperiments$data,
  ExperimentComparePage_selectedCompareExperiments$key,
} from "./__generated__/ExperimentComparePage_selectedCompareExperiments.graphql";
import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentCompareListPage } from "./ExperimentCompareListPage";
import { ExperimentCompareMetricsPage } from "./ExperimentCompareMetricsPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

type Experiment = NonNullable<
  ExperimentComparePage_selectedCompareExperiments$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentComparePage() {
  const [multiSelectorQueryReference, loadMultiSelectorQuery] =
    useQueryLoader<ExperimentComparePageQueriesMultiSelectorQueryType>(
      ExperimentComparePageQueriesMultiSelectorQuery
    );

  const [
    selectedCompareExperimentsQueryReference,
    loadSelectedCompareExperimentsQuery,
  ] =
    useQueryLoader<ExperimentComparePageQueriesSelectedCompareExperimentsQueryType>(
      ExperimentComparePageQueriesSelectedCompareExperimentsQuery
    );

  const [compareGridQueryReference, loadCompareGridQuery] =
    useQueryLoader<ExperimentComparePageQueriesCompareGridQueryType>(
      ExperimentComparePageQueriesCompareGridQuery
    );

  const [compareListQueryReference, loadCompareListQuery] =
    useQueryLoader<ExperimentComparePageQueriesCompareListQueryType>(
      ExperimentComparePageQueriesCompareListQuery
    );

  const [compareMetricsQueryReference, loadCompareMetricsQuery] =
    useQueryLoader<ExperimentComparePageQueriesCompareMetricsQueryType>(
      ExperimentComparePageQueriesCompareMetricsQuery
    );

  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const [searchParams] = useSearchParams();
  const { baseExperimentId = undefined, compareExperimentIds } = useMemo(() => {
    const [baseExperimentId = undefined, ...compareExperimentIds] =
      searchParams.getAll("experimentId");
    return { baseExperimentId, compareExperimentIds };
  }, [searchParams]);
  const viewMode: ExperimentCompareViewMode = useMemo(() => {
    const viewMode = searchParams.get("view");
    if (isExperimentCompareViewMode(viewMode)) {
      return viewMode;
    }
    return "grid";
  }, [searchParams]);
  const navigate = useNavigate();

  const onViewModeChange = useCallback(
    (viewMode: ExperimentCompareViewMode) => {
      searchParams.set("view", viewMode);
      navigate(`/datasets/${datasetId}/compare?${searchParams.toString()}`);
    },
    [datasetId, navigate, searchParams]
  );

  useEffect(() => {
    const experimentIds = [
      ...(baseExperimentId ? [baseExperimentId] : []),
      ...compareExperimentIds,
    ];
    loadMultiSelectorQuery({
      datasetId,
      hasBaseExperiment: baseExperimentId != null,
      baseExperimentId: baseExperimentId ?? "",
    });
    loadSelectedCompareExperimentsQuery({
      datasetId,
      experimentIds,
    });

    if (baseExperimentId != null) {
      switch (viewMode) {
        case "grid":
          loadCompareGridQuery({
            datasetId,
            experimentIds,
            baseExperimentId,
            compareExperimentIds,
          });
          break;
        case "list":
          loadCompareListQuery({
            datasetId,
            experimentIds,
            baseExperimentId,
            compareExperimentIds,
          });
          break;
        case "metrics":
          loadCompareMetricsQuery({
            datasetId,
            experimentIds,
            baseExperimentId,
            compareExperimentIds,
            hasCompareExperiments: compareExperimentIds.length > 0,
          });
          break;
        default:
          assertUnreachable(viewMode);
      }
    }
  }, [
    baseExperimentId,
    compareExperimentIds,
    datasetId,
    loadMultiSelectorQuery,
    loadSelectedCompareExperimentsQuery,
    loadCompareGridQuery,
    loadCompareListQuery,
    loadCompareMetricsQuery,
    viewMode,
  ]);

  if (multiSelectorQueryReference == null) {
    return <Loading />;
  }

  return (
    <main
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `}
    >
      <View
        paddingX="size-200"
        paddingTop="size-100"
        paddingBottom="size-200"
        borderBottomColor="dark"
        borderBottomWidth="thin"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          gap="size-150"
          alignItems="end"
        >
          <ExperimentMultiSelector
            queryRef={multiSelectorQueryReference}
            selectedBaseExperimentId={baseExperimentId}
            selectedCompareExperimentIds={compareExperimentIds}
            onChange={(newBaseExperimentId, newCompareExperimentIds) => {
              startTransition(() => {
                if (newBaseExperimentId == null) {
                  navigate(`/datasets/${datasetId}/compare`);
                } else {
                  searchParams.delete("experimentId");
                  [newBaseExperimentId, ...newCompareExperimentIds].forEach(
                    (experimentId) => {
                      searchParams.append("experimentId", experimentId);
                    }
                  );
                  navigate(
                    `/datasets/${datasetId}/compare?${searchParams.toString()}`
                  );
                }
              });
            }}
          />
          <View flex="1" paddingBottom={5}>
            <Suspense>
              {selectedCompareExperimentsQueryReference && (
                <SelectedCompareExperiments
                  queryRef={selectedCompareExperimentsQueryReference}
                />
              )}
            </Suspense>
          </View>
          <ExperimentCompareViewModeToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </Flex>
      </View>
      {baseExperimentId == null ? (
        <View padding="size-200">
          <Alert variant="info" title="No Experiment Selected">
            Please select an experiment.
          </Alert>
        </View>
      ) : (
        <ExperimentComparePageContent
          compareGridQueryReference={compareGridQueryReference ?? null}
          compareListQueryReference={compareListQueryReference ?? null}
          compareMetricsQueryReference={compareMetricsQueryReference ?? null}
        />
      )}
    </main>
  );
}

function ExperimentComparePageContent({
  compareGridQueryReference,
  compareListQueryReference,
  compareMetricsQueryReference,
}: {
  compareGridQueryReference: PreloadedQuery<ExperimentComparePageQueriesCompareGridQueryType> | null;
  compareListQueryReference: PreloadedQuery<ExperimentComparePageQueriesCompareListQueryType> | null;
  compareMetricsQueryReference: PreloadedQuery<ExperimentComparePageQueriesCompareMetricsQueryType> | null;
}) {
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get("view") ?? "grid";
  if (viewMode === "grid") {
    return compareGridQueryReference ? (
      <Suspense fallback={<Loading />}>
        <ExperimentCompareGridPage queryRef={compareGridQueryReference} />
      </Suspense>
    ) : (
      <Loading />
    );
  } else if (viewMode === "metrics") {
    return compareMetricsQueryReference ? (
      <Suspense fallback={<Loading />}>
        <ExperimentCompareMetricsPage queryRef={compareMetricsQueryReference} />
      </Suspense>
    ) : (
      <Loading />
    );
  } else if (viewMode === "list") {
    return compareListQueryReference ? (
      <Suspense fallback={<Loading />}>
        <ExperimentCompareListPage queryRef={compareListQueryReference} />
      </Suspense>
    ) : (
      <Loading />
    );
  }
  return (
    <View padding="size-200">
      <Alert variant="info" title={`Invalid View Mode Requested`}>
        {`Please enter a valid view ("grid" or "metrics") in the URL query parameters.`}
      </Alert>
    </View>
  );
}

export function SelectedCompareExperiments({
  queryRef,
}: {
  queryRef: PreloadedQuery<ExperimentComparePageQueriesSelectedCompareExperimentsQueryType>;
}) {
  const [searchParams] = useSearchParams();
  const [, ...compareExperimentIds] = searchParams.getAll("experimentId");
  const { getExperimentColor } = useExperimentColors();

  const preloadedData =
    usePreloadedQuery<ExperimentComparePageQueriesSelectedCompareExperimentsQueryType>(
      ExperimentComparePageQueriesSelectedCompareExperimentsQuery,
      queryRef
    );
  const data =
    useFragment<ExperimentComparePage_selectedCompareExperiments$key>(
      graphql`
        fragment ExperimentComparePage_selectedCompareExperiments on Query
        @argumentDefinitions(
          datasetId: { type: "ID!" }
          experimentIds: { type: "[ID!]!" }
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              experiments(filterIds: $experimentIds) {
                edges {
                  experiment: node {
                    id
                    sequenceNumber
                    name
                  }
                }
              }
            }
          }
        }
      `,
      preloadedData
    );
  const idToExperiment = useMemo(() => {
    const idToExperiment: Record<string, Experiment> = {};
    data.dataset.experiments?.edges.forEach((edge) => {
      idToExperiment[edge.experiment.id] = edge.experiment;
    });
    return idToExperiment;
  }, [data]);
  if (compareExperimentIds.length === 0) {
    return null;
  }
  const compareExperiments = compareExperimentIds
    .map((experimentId) => idToExperiment[experimentId])
    // if a new experiment was just added, data may not be fully loaded yet
    .filter((experiment) => experiment != null);

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      {compareExperiments.map((experiment, experimentIndex) => (
        <ExperimentNameWithColorSwatch
          key={experiment.id}
          color={getExperimentColor(experimentIndex)}
          name={experiment.name}
        />
      ))}
    </Flex>
  );
}
