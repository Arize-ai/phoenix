import { css } from "@emotion/react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { graphql } from "relay-runtime";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  LinkButton,
  ViewportModal,
  ViewportModalOverlay,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Text,
} from "@phoenix/components";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";

import type { PromptLayout__main$key } from "./__generated__/PromptLayout__main.graphql";
import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { PromptLabelConfigButton } from "./PromptLabelConfigButton";
import { promptLoaderQuery } from "./promptLoader";
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
  const selectedTab = pathname.endsWith("/config") ? "config" : "prompt";

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
      <PageHeader
        title={data.name}
        labels={data.labels}
        labelAction={<PromptLabelConfigButton promptId={data.id} />}
        subTitle={data.description}
        captionVisual={<Icon svg={<Icons.GitBranch />} />}
        caption={
          data.sourcePrompt && (
            <Text size="S" color="text-700">
              cloned from{" "}
              <Link to={`/prompts/${data.sourcePrompt.id}`}>
                {data.sourcePrompt.name}
              </Link>
            </Text>
          )
        }
        extra={
          <Flex direction="row" gap="size-100" justifyContent="end">
            <DialogTrigger>
              <Button
                size="M"
                leadingVisual={<Icon svg={<Icons.GitBranch />} />}
              >
                Clone
              </Button>
              <ViewportModalOverlay>
                <ViewportModal size="M">
                  <ClonePromptDialog
                    promptId={data.id}
                    promptName={data.name}
                    promptDescription={data.description ?? undefined}
                    promptMetadata={data.metadata ?? undefined}
                  />
                </ViewportModal>
              </ViewportModalOverlay>
            </DialogTrigger>
            <LinkButton
              variant="primary"
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
              to={playgroundPath}
              size="M"
              aria-label="Open this Prompt version in Playground"
            >
              Playground
            </LinkButton>
          </Flex>
        }
      />
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          navigate(
            key === "config"
              ? `/prompts/${data.id}/config`
              : `/prompts/${data.id}`
          );
        }}
      >
        <TabList>
          <Tab id="prompt">Prompt</Tab>
          <Tab id="config">Config</Tab>
        </TabList>
        <LazyTabPanel id="prompt">
          <Outlet />
        </LazyTabPanel>
        <LazyTabPanel id="config">
          <Outlet />
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
