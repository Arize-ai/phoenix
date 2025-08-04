import { startTransition, useCallback, useMemo } from "react";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Alert, Flex, View } from "@phoenix/components";
import {
  ExperimentCompareViewMode,
  ExperimentCompareViewModeToggle,
  isExperimentCompareViewMode,
} from "@phoenix/components/experiment/ExperimentCompareViewModeToggle";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";

import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentCompareMetricsPage } from "./ExperimentCompareMetricsPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";
import { SelectedCompareExperiments } from "./SelectedCompareExperiments";

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
        <Flex direction="row" justifyContent="space-between" alignItems="end">
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
