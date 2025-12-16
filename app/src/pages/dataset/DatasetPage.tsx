import { Suspense, useCallback, useMemo } from "react";
import { graphql, usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData, useLocation, useNavigate } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  Counter,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Tab,
  TabList,
  Tabs,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { DatasetLabelConfigButton } from "@phoenix/components/dataset";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { DatasetProvider } from "@phoenix/contexts/DatasetContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { datasetLoader } from "@phoenix/pages/dataset/datasetLoader";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { DatasetPageQuery } from "./__generated__/DatasetPageQuery.graphql";
import { DatasetCodeButton } from "./DatasetCodeButton";
import { RunExperimentButton } from "./RunExperimentButton";

export const DatasetPageQueryNode = graphql`
  query DatasetPageQuery($id: ID!) {
    dataset: node(id: $id) {
      id
      ... on Dataset {
        id
        name
        description
        exampleCount
        experimentCount
        labels {
          id
          name
          color
        }
        latestVersions: versions(
          first: 1
          sort: { col: createdAt, dir: desc }
        ) {
          edges {
            version: node {
              id
              description
              createdAt
            }
          }
        }
      }
    }
  }
`;

export function DatasetPage() {
  const loaderData = useLoaderData<typeof datasetLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<DatasetPageQuery>(
    DatasetPageQueryNode,
    loaderData.queryRef
  );

  const latestVersion = useMemo(() => {
    const versions = data.dataset.latestVersions;
    if (versions?.edges && versions.edges.length) {
      return versions.edges[0].version;
    }
    return null;
  }, [data]);

  return (
    <DatasetProvider
      datasetId={data.dataset.id}
      datasetName={data.dataset.name as string}
      latestVersion={latestVersion}
    >
      <Suspense fallback={<Loading />}>
        <DatasetPageContent dataset={data.dataset} />
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

  const navigate = useNavigate();
  const onTabChange = useCallback(
    (tabIndex: number) => {
      if (TABS_CONFIG[tabIndex as keyof typeof TABS_CONFIG]) {
        const path = TABS_CONFIG[tabIndex as keyof typeof TABS_CONFIG];
        navigate(`/datasets/${datasetId}/${path}`);
      }
    },
    [navigate, datasetId]
  );
  const datasetHasVersions = (dataset.latestVersions?.edges.length ?? 0) > 0;

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
              <Flex direction="column" gap="size-50">
                <Text elementType="h1" size="L" weight="heavy">
                  {dataset.name}
                </Text>
                <Text color="text-700">{dataset.description || "--"}</Text>
                {dataset.labels && dataset.labels.length > 0 && (
                  <ul
                    css={css`
                      display: flex;
                      flex-direction: row;
                      gap: var(--ac-global-dimension-size-100);
                      min-width: 0;
                      flex-wrap: wrap;
                      padding-top: var(--ac-global-dimension-size-50);
                    `}
                  >
                    {dataset.labels.map((label) => (
                      <li key={label.id}>
                        <Token color={label.color}>
                          <Truncate maxWidth={200} title={label.name}>
                            {label.name}
                          </Truncate>
                        </Token>
                      </li>
                    ))}
                  </ul>
                )}
              </Flex>
            </Flex>
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center">
            <MenuTrigger>
              <Button
                size="S"
                leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
              />
              <Popover>
                <Menu
                  aria-label="Dataset action menu"
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
                  <MenuItem id="csv">Download CSV</MenuItem>
                  <MenuItem id="openai-ft">
                    Download OpenAI Fine-Tuning JSONL
                  </MenuItem>
                  <MenuItem id="openai-evals">
                    Download OpenAI Evals JSONL
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
            <DatasetCodeButton />
            <RunExperimentButton />
            <DatasetLabelConfigButton datasetId={dataset.id} />
            <Button
              isDisabled={!datasetHasVersions}
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
