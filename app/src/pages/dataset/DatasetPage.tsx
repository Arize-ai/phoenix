import { Suspense, useCallback, useMemo } from "react";
import { Outlet, useLoaderData, useLocation, useNavigate } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { ActionMenu, Item } from "@arizeai/components";

import {
  Button,
  Counter,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  DatasetProvider,
  useDatasetContext,
} from "@phoenix/contexts/DatasetContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { datasetLoader } from "@phoenix/pages/dataset/datasetLoader";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { AddDatasetExampleButton } from "./AddDatasetExampleButton";
import { DatasetCodeButton } from "./DatasetCodeButton";
import { RunExperimentButton } from "./RunExperimentButton";

export function DatasetPage() {
  const loaderData = useLoaderData<typeof datasetLoader>();
  invariant(loaderData, "loaderData is required");
  const latestVersion = useMemo(() => {
    const versions = loaderData.dataset.latestVersions;
    if (versions?.edges && versions.edges.length) {
      return versions.edges[0].version;
    }
    return null;
  }, [loaderData]);

  return (
    <DatasetProvider
      datasetId={loaderData.dataset.id}
      datasetName={loaderData.dataset.name as string}
      latestVersion={latestVersion}
    >
      <Suspense fallback={<Loading />}>
        <DatasetPageContent dataset={loaderData["dataset"]} />
      </Suspense>
    </DatasetProvider>
  );
}

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .ac-tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .ac-tabs__pane-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }
  }
`;

const TABS_CONFIG = {
  0: "experiments",
  1: "examples",
  2: "versions",
  3: "evaluators",
} as const;

const TABS_LIST = Object.values(TABS_CONFIG);

type TabName = (typeof TABS_LIST)[number];

function isTabName(name: unknown): name is TabName {
  return typeof name === "string" && (TABS_LIST as string[]).includes(name);
}

function getTabIndexFromPathname(pathname: string): number {
  // We only need the last part of the path
  const path = pathname.split("/").at(-1);
  if (isTabName(path)) {
    return TABS_LIST.indexOf(path);
  }
  return 0;
}

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  const isEvaluatorsEnabled = useFeatureFlag("evaluators");
  const datasetId = dataset.id;
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifySuccess = useNotifySuccess();

  const navigate = useNavigate();
  const onTabChange = useCallback(
    (tabIndex: number) => {
      if (tabIndex === 0) {
        navigate(`/datasets/${datasetId}/experiments`);
      } else if (tabIndex === 1) {
        navigate(`/datasets/${datasetId}/examples`);
      } else if (tabIndex === 2) {
        navigate(`/datasets/${datasetId}/versions`);
      } else if (tabIndex === 3) {
        navigate(`/datasets/${datasetId}/evaluators`);
      }
    },
    [navigate, datasetId]
  );

  // Set the initial tab
  const location = useLocation();
  const initialIndex = getTabIndexFromPathname(location.pathname);
  return (
    <main css={mainCSS}>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-200"
        paddingBottom="size-50"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between" alignItems="start">
          <Flex
            direction="column"
            justifyContent="space-between"
            alignItems="start"
          >
            <Flex direction="row" gap="size-200" alignItems="center">
              {/* TODO(datasets): Add an icon here to make the UI cohesive */}
              {/* <Icon svg={<Icons.DatabaseOutline />} /> */}
              <Flex direction="column">
                <Text elementType="h1" size="L" weight="heavy">
                  {dataset.name}
                </Text>
                <Text color="text-700">{dataset.description || "--"}</Text>
              </Flex>
            </Flex>
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center">
            <ActionMenu
              align="end"
              buttonSize="compact"
              icon={<Icon svg={<Icons.DownloadOutline />} />}
              onAction={(action) => {
                switch (action) {
                  case "csv":
                    window.open(
                      prependBasename(`/v1/datasets/${dataset.id}/csv`),
                      "_blank"
                    );
                    break;
                  case "openai-ft":
                    window.open(
                      prependBasename(
                        `/v1/datasets/${dataset.id}/jsonl/openai_ft`
                      ),
                      "_blank"
                    );
                    break;
                  case "openai-evals":
                    window.open(
                      prependBasename(
                        `/v1/datasets/${dataset.id}/jsonl/openai_evals`
                      ),
                      "_blank"
                    );
                    break;
                }
              }}
            >
              <Item key="csv">Download CSV</Item>
              <Item key="openai-ft">Download OpenAI Fine-Tuning JSONL</Item>
              <Item key="openai-evals">Download OpenAI Evals JSONL</Item>
            </ActionMenu>
            <DatasetCodeButton />
            <RunExperimentButton />
            <AddDatasetExampleButton
              datasetId={dataset.id}
              onAddExampleCompleted={() => {
                notifySuccess({
                  title: "Example added",
                  message:
                    "The example has been added successfully and the version has been updated.",
                });
                refreshLatestVersion();
              }}
            />
            <Button
              size="S"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              onPress={() => {
                navigate(`/playground?datasetId=${dataset.id}`);
              }}
            >
              Playground
            </Button>
          </Flex>
        </Flex>
      </View>
      <Tabs
        defaultSelectedKey={
          initialIndex === 0
            ? "experiments"
            : initialIndex === 1
              ? "examples"
              : "versions"
        }
        onSelectionChange={(key) => {
          if (isTabName(key)) {
            onTabChange(TABS_LIST.indexOf(key));
          }
        }}
      >
        <TabList>
          <Tab id="experiments">
            Experiments <Counter>{dataset.experimentCount}</Counter>
          </Tab>
          <Tab id="examples">
            Examples <Counter>{dataset.exampleCount}</Counter>
          </Tab>
          <Tab id="versions">Versions</Tab>
          {isEvaluatorsEnabled ? (
            <Tab id="evaluators" isDisabled={!isEvaluatorsEnabled}>
              Evaluators
            </Tab>
          ) : null}
        </TabList>
        <LazyTabPanel id="experiments">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="examples">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="evaluators">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
