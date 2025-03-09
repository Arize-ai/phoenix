import React, { useState } from "react";
import { useFragment } from "react-relay";
import { Outlet, useLocation, useNavigate } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Counter, DialogContainer, TabPane, Tabs } from "@arizeai/components";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  Link,
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
  let tabIndex = 0;
  if (pathname.includes("versions")) {
    tabIndex = 1;
  } else if (pathname.includes("config")) {
    tabIndex = 2;
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
        index={tabIndex}
        onChange={(index) => {
          let url: string;
          if (index === 1) {
            url = `/prompts/${loaderData.prompt.id}/versions`;
          } else if (index === 2) {
            url = `/prompts/${loaderData.prompt.id}/config`;
          } else {
            url = `/prompts/${loaderData.prompt.id}`;
          }
          navigate(url);
        }}
      >
        <TabPane name={"Prompt"}>
          {({ isSelected }) => {
            if (isSelected) {
              return <Outlet />;
            }
            return null;
          }}
        </TabPane>
        <TabPane
          name={"Versions"}
          extra={<Counter>{data.promptVersions.edges.length}</Counter>}
        >
          {({ isSelected }) => {
            if (isSelected) {
              return <Outlet />;
            }
            return null;
          }}
        </TabPane>
        <TabPane name={"Config"}>
          {({ isSelected }) => {
            if (isSelected) {
              return <Outlet />;
            }
            return null;
          }}
        </TabPane>
      </Tabs>
      <DialogContainer onDismiss={() => setDialog(null)}>
        {dialog}
      </DialogContainer>
    </main>
  );
}
