import { useState } from "react";
import { useFragment } from "react-relay";
import { Outlet, useLocation, useNavigate } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { DialogContainer } from "@arizeai/components";

import {
  Button,
  Counter,
  Flex,
  Heading,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";

import { PromptLayout__main$key } from "./__generated__/PromptLayout__main.graphql";
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
  const [dialog, setDialog] = useState<React.ReactNode | null>(null);
  const loaderData = usePromptIdLoader();
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
    loaderData.prompt
  );

  return (
    <main css={mainCSS}>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Flex direction="column">
            <Heading level={1}>{loaderData.prompt.name}</Heading>
            {data.sourcePrompt && (
              <Text color="text-700">
                cloned from{" "}
                <Link to={`/prompts/${data.sourcePrompt.id}`}>
                  {data.sourcePrompt.name}
                </Link>
              </Text>
            )}
          </Flex>

          <Flex direction="row" gap="size-100">
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.DuplicateIcon />} />}
              onPress={() => {
                setDialog(
                  <ClonePromptDialog
                    promptId={data.id}
                    promptName={data.name}
                    promptDescription={data.description ?? undefined}
                    setDialog={setDialog}
                  />
                );
              }}
            >
              Clone
            </Button>
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.Edit2Outline />} />}
              onPress={() => {
                navigate(`/prompts/${loaderData.prompt.id}/playground`);
              }}
            >
              Edit in Playground
            </Button>
          </Flex>
        </Flex>
      </View>
      <Tabs
        defaultSelectedKey={defaultTab}
        onSelectionChange={(key) => {
          let url: string;
          if (key === "versions") {
            url = `/prompts/${loaderData.prompt.id}/versions`;
          } else if (key === "config") {
            url = `/prompts/${loaderData.prompt.id}/config`;
          } else {
            url = `/prompts/${loaderData.prompt.id}`;
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
      <DialogContainer onDismiss={() => setDialog(null)}>
        {dialog}
      </DialogContainer>
    </main>
  );
}
