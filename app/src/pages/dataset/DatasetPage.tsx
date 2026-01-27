import { Suspense, useCallback, useMemo } from "react";
import { graphql, usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData, useLocation, useNavigate } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Counter,
  Flex,
  Heading,
  LazyTabPanel,
  Loading,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Token,
} from "@phoenix/components";
import { DatasetLabelConfigButton } from "@phoenix/components/dataset";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { DatasetProvider } from "@phoenix/contexts/DatasetContext";
import { datasetLoader } from "@phoenix/pages/dataset/datasetLoader";

import {
  DatasetPageQuery,
  DatasetPageQuery$data,
} from "./__generated__/DatasetPageQuery.graphql";
import { DatasetDownloadMenu } from "./DatasetDownloadMenu";
import { RunDatasetExperimentButton } from "./RunDatasetExperimentButton";

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
        evaluatorCount
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
  2: "evaluators",
  3: "jobs",
  4: "versions",
} as const;

const TABS_LIST = Object.values(TABS_CONFIG);

type TabName = (typeof TABS_LIST)[number];

function isTabName(name: unknown): name is TabName {
  return typeof name === "string" && (TABS_LIST as string[]).includes(name);
}

function getTabIndexFromPathname(pathname: string): number {
  // Check all path segments for a valid tab name
  // This handles nested routes like /datasets/:id/examples/:exampleId
  const segments = pathname.split("/");
  for (const segment of segments) {
    if (isTabName(segment)) {
      return TABS_LIST.indexOf(segment);
    }
  }
  return 0;
}

function DatasetPageContent({
  dataset,
}: {
  dataset: DatasetPageQuery$data["dataset"];
}) {
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

  // Set the initial tab
  const location = useLocation();
  const initialIndex = getTabIndexFromPathname(location.pathname);
  return (
    <main css={mainCSS}>
      <PageHeader
        title={
          <Flex direction="row" gap="size-100" alignItems="center">
            <Heading level={1}>{dataset.name}</Heading>
            {dataset.labels && dataset.labels.length > 0 && (
              <ul
                css={css`
                  display: flex;
                  flex-direction: row;
                  gap: var(--ac-global-dimension-size-100);
                  min-width: 0;
                  flex-wrap: wrap;
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
        }
        subTitle={dataset.description || "--"}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <DatasetDownloadMenu datasetId={dataset.id} />
            <DatasetLabelConfigButton datasetId={dataset.id} />
            <RunDatasetExperimentButton variant="primary" size="M" />
          </Flex>
        }
      />
      <Tabs
        selectedKey={TABS_LIST[initialIndex]}
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
          <Tab id="evaluators">
            Evaluators <Counter>{dataset.evaluatorCount}</Counter>
          </Tab>
          <Tab id="jobs">Jobs</Tab>
          <Tab id="versions">Versions</Tab>
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
        <LazyTabPanel id="evaluators">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="jobs">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <Suspense>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
