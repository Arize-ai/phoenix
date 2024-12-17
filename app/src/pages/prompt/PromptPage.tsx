import React from "react";
import { useLoaderData, useNavigate } from "react-router";
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

import { promptLoaderQuery$data } from "./__generated__/promptLoaderQuery.graphql";
import { PromptTabContent } from "./PromptTabContent";

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

export function PromptPage() {
  const loaderData = useLoaderData() as promptLoaderQuery$data;
  const navigate = useNavigate();
  return (
    <main css={mainCSS}>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between">
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
      <Tabs>
        <TabPane name={"Prompt"}>
          <PromptTabContent prompt={loaderData.prompt} />
        </TabPane>
        <TabPane name={"Versions"} extra={<Counter>0</Counter>}>
          Versions
        </TabPane>
      </Tabs>
    </main>
  );
}
