import React, { PropsWithChildren } from "react";
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
import { PlaygroundInstanceProps } from "./types";

export function PlaygroundInstance(props: PlaygroundInstanceProps) {
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const isSingleInstance = numInstances == 1;
  return (
    <PanelGroup direction={isSingleInstance ? "horizontal" : "vertical"}>
      <Panel defaultSize={50} order={1}>
        <PanelContent>
          <PlaygroundTemplate {...props} />
        </PanelContent>
      </Panel>
      <PanelResizeHandle
        css={isSingleInstance ? resizeHandleCSS : compactResizeHandleCSS}
      />
      <Panel defaultSize={50} order={2}>
        <PanelContent>
          <PlaygroundInput />
          <PlaygroundOutput {...props} />
        </PanelContent>
      </Panel>
    </PanelGroup>
  );
}

const PanelContent = (props: PropsWithChildren) => (
  <div
    css={css`
      height: 100%;
      padding: var(--ac-global-dimension-size-200);
      overflow: auto;
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-200);
        padding-bottom: var(--ac-global-dimension-size-400);
      `}
    >
      {props.children}
    </div>
  </div>
);
