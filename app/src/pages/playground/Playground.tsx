import React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Button, Flex, Heading, View } from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  PlaygroundContext,
  PlaygroundProvider,
} from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundModeRadioGroup } from "./PlaygroundModeRadioGroup";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { PlaygroundTools } from "./PlaygroundTools";

const panelContentCSS = css`
  padding: var(--ac-global-dimension-size-200);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
`;

export function Playground() {
  return (
    <PlaygroundProvider>
      <View
        borderBottomColor="dark"
        borderBottomWidth="thin"
        padding="size-200"
      >
        <Flex direction="row" justifyContent="space-between">
          <View>
            <Flex direction="row" gap="size-200" alignItems="center">
              <Heading level={1}>Playground</Heading>
              <PlaygroundModeRadioGroup />
            </Flex>
          </View>
          <Button variant="default">API Keys</Button>
        </Flex>
      </View>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={50} order={1} css={panelContentCSS}>
          <PlaygroundTemplate />
          <PlaygroundTools />
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel defaultSize={50} order={2} css={panelContentCSS}>
          <PlaygroundInput />
          <PlaygroundOutput />
        </Panel>
      </PanelGroup>
    </PlaygroundProvider>
  );
}
