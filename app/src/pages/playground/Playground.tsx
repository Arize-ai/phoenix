import React, { Fragment } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { Button, Flex, Heading, Icon, Icons, View } from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { InitialPlaygroundState } from "@phoenix/store";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundInputTypeTypeRadioGroup } from "./PlaygroundInputModeRadioGroup";
import { PlaygroundInstance } from "./PlaygroundInstance";
import { PlaygroundRunButton } from "./PlaygroundRunButton";

export function Playground(props: InitialPlaygroundState) {
  return (
    <PlaygroundProvider {...props}>
      <Flex direction="column" height="100%">
        <View
          borderBottomColor="dark"
          borderBottomWidth="thin"
          padding="size-200"
          flex="none"
        >
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={1}>Playground</Heading>
            <Flex direction="row" gap="size-100" alignItems="center">
              <PlaygroundInputTypeTypeRadioGroup />
              <Button variant="default" size="compact">
                API Keys
              </Button>
              <AddPromptButton />
              <PlaygroundRunButton />
            </Flex>
          </Flex>
        </View>
        <PlaygroundInstances />
      </Flex>
    </PlaygroundProvider>
  );
}

function AddPromptButton() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  return (
    <Button
      variant="default"
      size="compact"
      aria-label="add prompt"
      icon={<Icon svg={<Icons.PlusCircleOutline />} />}
      disabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES}
      onClick={() => {
        addInstance();
      }}
    >
      Prompt
    </Button>
  );
}

function PlaygroundInstances() {
  const instances = usePlaygroundContext((state) => state.instances);
  return (
    <Flex direction="row" alignItems="stretch" height="100%" flex="1 1 auto">
      <PanelGroup direction="horizontal">
        {instances.map((instance, i) => (
          <Fragment key={i}>
            {i !== 0 && <PanelResizeHandle css={resizeHandleCSS} />}
            <Panel defaultSize={50}>
              <PlaygroundInstance key={i} playgroundInstanceId={instance.id} />
            </Panel>
          </Fragment>
        ))}
      </PanelGroup>
    </Flex>
  );
}
