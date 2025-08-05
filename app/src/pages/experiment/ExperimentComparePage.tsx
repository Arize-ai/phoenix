import { startTransition, useCallback, useMemo, useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import { Alert, Flex, View } from "@phoenix/components";
import {
  ExperimentCompareView,
  ExperimentCompareViewSelect,
  isExperimentCompareView,
} from "@phoenix/components/experiment/ExperimentCompareViewSelect";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentCompareMetricsPage } from "./ExperimentCompareMetricsPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const showModeSelect = useFeatureFlag("experimentEnhancements");
  invariant(loaderData, "loaderData is required on ExperimentComparePage");
  // The text of most IO is too long so default to showing truncated text
  const [displayFullText, setDisplayFullText] = useState(false);
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const [searchParams] = useSearchParams();
  const [baseExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const view = useMemo(() => {
    const view = searchParams.get("view");
    if (isExperimentCompareView(view)) {
      return view;
    }
    return "grid";
  }, [searchParams]);
  const navigate = useNavigate();

  const onViewChange = useCallback(
    (view: ExperimentCompareView) => {
      searchParams.set("view", view);
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
          <Flex direction="row" gap="size-100" justifyContent="start">
            <ExperimentMultiSelector
              dataRef={loaderData}
              selectedBaseExperimentId={baseExperimentId}
              selectedCompareExperimentIds={compareExperimentIds}
              onChange={(newBaseExperimentId, newCompareExperimentIds) => {
                startTransition(() => {
                  if (newBaseExperimentId == null) {
                    navigate(`/datasets/${datasetId}/compare`);
                  } else {
                    const queryParams = `?${[
                      newBaseExperimentId,
                      ...newCompareExperimentIds,
                    ]
                      .map((id) => `experimentId=${id}`)
                      .join("&")}`;
                    navigate(`/datasets/${datasetId}/compare${queryParams}`);
                  }
                });
              }}
            />
            {showModeSelect && (
              <ExperimentCompareViewSelect
                view={view}
                onViewChange={onViewChange}
              />
            )}
          </Flex>
          <Switch
            onChange={(isSelected) => {
              setDisplayFullText(isSelected);
            }}
            defaultSelected={false}
            labelPlacement="start"
          >
            Full Text
          </Switch>
        </Flex>
      </View>
      {baseExperimentId == null ? (
        <View padding="size-200">
          <Alert variant="info" title="No Base Experiment Selected">
            Please select a base experiment.
          </Alert>
        </View>
      ) : (
        <ExperimentComparePageContent
          view={view}
          displayFullText={displayFullText}
        />
      )}
    </main>
  );
}

type ExperimentComparePageContentProps = {
  view: ExperimentCompareView;
  displayFullText: boolean;
};

function ExperimentComparePageContent({
  view,
  displayFullText,
}: ExperimentComparePageContentProps) {
  if (view === "grid") {
    return <ExperimentCompareGridPage displayFullText={displayFullText} />;
  } else if (view === "metrics") {
    return <ExperimentCompareMetricsPage />;
  }
  assertUnreachable(view);
}
