import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  Counter,
  Flex,
  Heading,
  Icon,
  Icons,
  TabPane,
  Tabs,
  View,
} from "@arizeai/components";

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

/**
 * Given a tab index and a promptId, return the URL for that tab.
 */
function makePromptUrl({
  index,
  promptId,
}: {
  index: number;
  promptId: string;
}) {
  if (index === 1) {
    return `/prompts/${promptId}/versions`;
  } else {
    return `/prompts/${promptId}`;
  }
}

export function PromptLayout() {
  const loaderData = usePromptIdLoader();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let tabIndex = 0;
  if (pathname.includes("versions")) {
    tabIndex = 1;
  }

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
          <Heading level={1}>{loaderData.prompt.name}</Heading>
          <Button
            variant="default"
            size="compact"
            icon={<Icon svg={<Icons.Edit2Outline />} />}
            onClick={() => {
              navigate(`/prompts/${loaderData.prompt.id}/playground`);
            }}
          >
            Edit in Playground
          </Button>
        </Flex>
      </View>
      <Tabs
        index={tabIndex}
        onChange={(index) => {
          navigate(makePromptUrl({ index, promptId: loaderData.prompt.id }));
        }}
      >
        <TabPane name={"Prompt"}>
          <Outlet />
        </TabPane>
        <TabPane name={"Versions"} extra={<Counter>0</Counter>}>
          <Outlet />
        </TabPane>
      </Tabs>
    </main>
  );
}
