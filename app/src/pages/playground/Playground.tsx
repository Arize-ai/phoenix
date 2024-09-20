import React, { useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { Button, Flex, Heading, View } from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstance } from "./PlaygroundInstance";
import { PlaygroundOperationTypeRadioGroup } from "./PlaygroundOperationTypeRadioGroup";

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
              <PlaygroundOperationTypeRadioGroup />
            </Flex>
          </View>
          <Button variant="default">API Keys</Button>
        </Flex>
      </View>
      <PlaygroundInstances />
    </PlaygroundProvider>
  );
}

function PlaygroundInstances() {
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const indices = useMemo(
    () => Array.from({ length: numInstances }, (_, i) => i),
    [numInstances]
  );
  return (
    <Flex direction="row" alignItems="stretch" height="100%">
      <PanelGroup direction="horizontal">
        {indices.map((i) => (
          <>
            {i !== 0 && <PanelResizeHandle css={resizeHandleCSS} />}
            <Panel defaultSize={50}>
              <PlaygroundInstance key={i} playgroundInstanceIndex={i} />
            </Panel>
          </>
        ))}
      </PanelGroup>
    </Flex>
  );
}
