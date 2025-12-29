import { useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useLocation, useNavigate } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Counter,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  LinkButton,
  Modal,
  ModalOverlay,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Text,
} from "@phoenix/components";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";

import { PromptLayout__main$key } from "./__generated__/PromptLayout__main.graphql";
import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { promptLoaderQuery } from "./promptLoader";
import { usePromptIdLoader } from "./usePromptIdLoader";

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

export function PromptLayout() {
  const loaderData = usePromptIdLoader();
  const preloadedData = usePreloadedQuery<promptLoaderQueryType>(
    promptLoaderQuery,
    loaderData.queryRef
  );

  const navigate = useNavigate();
  const { pathname } = useLocation();
  let defaultTab = "prompt";
  if (pathname.includes("versions")) {
    defaultTab = "versions";
  } else if (pathname.includes("config")) {
    defaultTab = "config";
  }

  const data = useFragment<PromptLayout__main$key>(
    graphql`
      fragment PromptLayout__main on Prompt {
        id
        name
        description
        metadata
        sourcePrompt {
          id
          name
        }
        promptVersions {
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

  return (
    <main css={mainCSS}>
      <PageHeader
        title={data.name}
        subTitle={
          data.sourcePrompt && (
            <Text color="text-700">
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
                leadingVisual={<Icon svg={<Icons.DuplicateIcon />} />}
              >
                Clone
              </Button>
              <ModalOverlay>
                <Modal size="M">
                  <ClonePromptDialog
                    promptId={data.id}
                    promptName={data.name}
                    promptDescription={data.description ?? undefined}
                    promptMetadata={data.metadata ?? undefined}
                  />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
            <LinkButton
              variant="primary"
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              to="playground"
              size="M"
              aria-label="Open this Prompt in Playground"
            >
              Playground
            </LinkButton>
          </Flex>
        }
      />
      <Tabs
        defaultSelectedKey={defaultTab}
        onSelectionChange={(key) => {
          let url: string;
          if (key === "versions") {
            url = `/prompts/${data.id}/versions`;
          } else if (key === "config") {
            url = `/prompts/${data.id}/config`;
          } else {
            url = `/prompts/${data.id}`;
          }
          navigate(url);
        }}
      >
        <TabList>
          <Tab id="prompt">Prompt</Tab>
          <Tab id="versions">
            Versions <Counter>{data.promptVersions.edges.length}</Counter>
          </Tab>
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
