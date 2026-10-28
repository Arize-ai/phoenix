import { css } from "@emotion/react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { graphql } from "relay-runtime";

import { LazyTabPanel, Tab, TabList, Tabs } from "@phoenix/components";

import type { PromptLayout__main$key } from "./__generated__/PromptLayout__main.graphql";
import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { promptLoaderQuery } from "./promptLoader";
import { PromptPageHeader } from "./PromptPageHeader";
import { usePromptIdLoader } from "./usePromptIdLoader";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
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

export function PromptLayout() {
  const loaderData = usePromptIdLoader();
  const preloadedData = usePreloadedQuery<promptLoaderQueryType>(
    promptLoaderQuery,
    loaderData.queryRef
  );

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { versionId } = useParams();
  let selectedTab = "prompt";
  if (pathname.endsWith("/config")) {
    selectedTab = "config";
  } else if (/\/versions(\/|$)/.test(pathname)) {
    selectedTab = "versions";
  }

  const data = useFragment<PromptLayout__main$key>(
    graphql`
      fragment PromptLayout__main on Prompt {
        id
        name
        description
        metadata
        labels {
          id
          name
          color
        }
        sourcePrompt {
          id
          name
        }
        latestVersion: promptVersions(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `,
    preloadedData.prompt
  );

  const viewedVersionId = versionId ?? data.latestVersion.edges[0]?.node.id;
  const playgroundParams = new URLSearchParams({ promptId: data.id });
  if (viewedVersionId) {
    playgroundParams.set("promptVersionId", viewedVersionId);
  }
  const playgroundPath = `/playground?${playgroundParams}`;

  return (
    <main css={mainCSS}>
      <PromptPageHeader prompt={data} playgroundPath={playgroundPath} />
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          navigate(
            key === "prompt"
              ? `/prompts/${data.id}`
              : `/prompts/${data.id}/${key}`
          );
        }}
      >
        <TabList>
          <Tab id="prompt">Prompt</Tab>
          <Tab id="versions">Versions</Tab>
          <Tab id="config">Config</Tab>
        </TabList>
        <LazyTabPanel id="prompt">
          <Outlet />
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <Outlet />
        </LazyTabPanel>
        <LazyTabPanel id="config">
          <Outlet />
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
