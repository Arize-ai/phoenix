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
import { datasetLoader } from "@phoenix/pages/dataset/datasetLoader";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { AddDatasetExampleButton } from "./AddDatasetExampleButton";
import { DatasetCodeDropdown } from "./DatasetCodeDropdown";
import { DatasetHistoryButton } from "./DatasetHistoryButton";
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

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
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
      }
    },
    [navigate, datasetId]
  );

  // Set the initial tab
  const location = useLocation();
  const initialIndex = location.pathname.includes("examples") ? 1 : 0;
  return (
    <main css={mainCSS}>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-200"
        paddingBottom="size-50"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Flex direction="column" justifyContent="space-between">
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
          <Flex direction="row" gap="size-100">
            <ActionMenu
              align="end"
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
            <DatasetHistoryButton datasetId={dataset.id} />
            <DatasetCodeDropdown />
            <RunExperimentButton />
            <Button
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              onPress={() => {
                navigate(`/playground?datasetId=${dataset.id}`);
              }}
            >
              Playground
            </Button>
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
          </Flex>
        </Flex>
      </View>
      <Tabs
        defaultSelectedKey={initialIndex === 0 ? "experiments" : "examples"}
        onSelectionChange={(key) => {
          switch (key) {
            case "experiments":
              onTabChange(0);
              break;
            case "examples":
              onTabChange(1);
              break;
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
      </Tabs>
    </main>
  );
}
