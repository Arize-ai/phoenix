import React from "react";
import { useFragment } from "react-relay";
import { Outlet, useLocation, useNavigate } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Counter, TabPane, Tabs } from "@arizeai/components";

import { Button, Flex, Heading, Icon, Icons, View } from "@phoenix/components";

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
  const loaderData = usePromptIdLoader();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let tabIndex = 0;
  if (pathname.includes("versions")) {
    tabIndex = 1;
  }

  const data = useFragment<PromptLayout__main$key>(
    graphql`
      fragment PromptLayout__main on Prompt {
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
          <Heading level={1}>{loaderData.prompt.name}</Heading>
          <Button
            size="S"
            icon={<Icon svg={<Icons.Edit2Outline />} />}
            onPress={() => {
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
          let url: string;
          if (index === 1) {
            url = `/prompts/${loaderData.prompt.id}/versions`;
          } else {
            url = `/prompts/${loaderData.prompt.id}`;
          }
          navigate(url);
        }}
      >
        <TabPane name={"Prompt"}>
          <Outlet />
        </TabPane>
        <TabPane
          name={"Versions"}
          extra={<Counter>{data.promptVersions.edges.length}</Counter>}
        >
          <Outlet />
        </TabPane>
      </Tabs>
    </main>
  );
}
