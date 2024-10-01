import React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  compactResizeHandleCSS,
  resizeHandleCSS,
} from "@phoenix/components/resize";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { PlaygroundTools } from "./PlaygroundTools";
import { PlaygroundInstanceProps } from "./types";

const panelContentCSS = css`
  padding: var(--ac-global-dimension-size-200);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
`;

export function PlaygroundInstance(props: PlaygroundInstanceProps) {
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const isSingleInstance = numInstances == 1;
  return (
    <PanelGroup direction={isSingleInstance ? "horizontal" : "vertical"}>
      <Panel defaultSize={50} order={1} css={panelContentCSS}>
        <PlaygroundTemplate {...props} />
        <PlaygroundTools />
      </Panel>
      <PanelResizeHandle
        css={isSingleInstance ? resizeHandleCSS : compactResizeHandleCSS}
      />
      <Panel defaultSize={50} order={2} css={panelContentCSS}>
        <PlaygroundInput />
        <PlaygroundOutput {...props} />
      </Panel>
    </PanelGroup>
  );
}
