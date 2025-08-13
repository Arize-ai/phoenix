import { startTransition, useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Alert, Flex, Text, View } from "@phoenix/components";
import { ColorSwatch } from "@phoenix/components/ColorSwatch";
import { useExperimentColors } from "@phoenix/components/experiment";
import {
  ExperimentCompareViewMode,
  ExperimentCompareViewModeToggle,
  isExperimentCompareViewMode,
} from "@phoenix/components/experiment/ExperimentCompareViewModeToggle";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";

import type {
  ExperimentComparePage_selectedCompareExperiments$data,
  ExperimentComparePage_selectedCompareExperiments$key,
} from "./__generated__/ExperimentComparePage_selectedCompareExperiments.graphql";
import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentCompareMetricsPage } from "./ExperimentCompareMetricsPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

type Experiment = NonNullable<
  ExperimentComparePage_selectedCompareExperiments$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const showViewModeSelect = useFeatureFlag("experimentEnhancements");
  invariant(loaderData, "loaderData is required on ExperimentComparePage");
  // The text of most IO is too long so default to showing truncated text
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const [searchParams] = useSearchParams();
  const [baseExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const viewMode = useMemo(() => {
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
        padding="size-200"
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
            dataRef={loaderData}
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
          <View
            flex="1"
            paddingStart="size-200"
            paddingEnd="size-200"
            paddingBottom="size-115"
          >
            <SelectedCompareExperiments dataRef={loaderData} />
          </View>
          {showViewModeSelect && (
            <ExperimentCompareViewModeToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />
          )}
        </Flex>
      </View>
      {baseExperimentId == null ? (
        <View padding="size-200">
          <Alert variant="info" title="No Base Experiment Selected">
            Please select a base experiment.
          </Alert>
        </View>
      ) : (
        <ExperimentComparePageContent />
      )}
    </main>
  );
}

function ExperimentComparePageContent() {
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get("view") ?? "grid";
  if (viewMode === "grid") {
    return <ExperimentCompareGridPage />;
  } else if (viewMode === "metrics") {
    return <ExperimentCompareMetricsPage />;
  } else {
    return (
      <View padding="size-200">
        <Alert variant="info" title={`Invalid View Mode Requested`}>
          {`Please enter a valid view ("grid" or "metrics") in the URL query parameters.`}
        </Alert>
      </View>
    );
  }
}

export function SelectedCompareExperiments({
  dataRef,
}: {
  dataRef: ExperimentComparePage_selectedCompareExperiments$key;
}) {
  const [searchParams] = useSearchParams();
  const [, ...compareExperimentIds] = searchParams.getAll("experimentId");
  const { getExperimentColor } = useExperimentColors();
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
      dataRef
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
  const compareExperiments = compareExperimentIds.map(
    (experimentId) => idToExperiment[experimentId]
  );
  return (
    <Flex direction="row" gap="size-250" alignItems="center">
      {compareExperiments.map((experiment, experimentIndex) => (
        <Flex
          direction="row"
          gap="size-100"
          key={experiment.id}
          alignItems="center"
        >
          <ColorSwatch
            color={getExperimentColor(experimentIndex)}
            shape="circle"
          />
          <Text
            css={css`
              white-space: nowrap;
              max-width: var(--ac-global-dimension-size-2000);
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {experiment.name}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
