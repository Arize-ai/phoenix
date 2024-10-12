import React, { Fragment } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  Accordion,
  AccordionItem,
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { InitialPlaygroundState } from "@phoenix/store";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundCredentialsDropdown } from "./PlaygroundCredentialsDropdown";
import { PlaygroundInputTypeTypeRadioGroup } from "./PlaygroundInputModeRadioGroup";
import { PlaygroundInstance } from "./PlaygroundInstance";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundRunButton } from "./PlaygroundRunButton";
import { PlaygroundTemplate } from "./PlaygroundTemplate";

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
              <PlaygroundCredentialsDropdown />
              <AddPromptButton />
              <PlaygroundRunButton />
            </Flex>
          </Flex>
        </View>
        <PlaygroundContent />
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

function PlaygroundContent() {
  const instances = usePlaygroundContext((state) => state.instances);
  const numInstances = instances.length;
  const isSingleInstance = numInstances === 1;

  if (isSingleInstance) {
    return <SingleInstancePlayground />;
  } else {
    return <MultiInstancePlayground />;
  }
}

function SingleInstancePlayground() {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  return (
    <PanelGroup direction="horizontal" autoSaveId="playground-single">
      <Panel defaultSize={50}>
        <Accordion>
          <AccordionItem title="Prompts" id="prompts">
            <View padding="size-200" height="100%">
              <PlaygroundTemplate playgroundInstanceId={instanceId} />
            </View>
          </AccordionItem>
        </Accordion>
      </Panel>
      <PanelResizeHandle css={resizeHandleCSS} />
      <Panel defaultSize={50}>
        <Accordion>
          <AccordionItem title="Inputs" id="input">
            <View padding="size-200">Input goes here</View>
          </AccordionItem>
          <AccordionItem title="Output" id="output">
            <View padding="size-200" height="100%">
              <PlaygroundOutput playgroundInstanceId={instanceId} />
            </View>
          </AccordionItem>
        </Accordion>
      </Panel>
    </PanelGroup>
  );
}

function MultiInstancePlayground() {
  const instances = usePlaygroundContext((state) => state.instances);
  return (
    <Accordion>
      <AccordionItem title="Prompts" id="prompts">
        <View padding="size-200" height="100%">
          <Flex direction="row" gap="size-200">
            {instances.map((instance, i) => (
              <View key={i} flex="1 1 auto">
                <PlaygroundTemplate
                  key={i}
                  playgroundInstanceId={instance.id}
                />
              </View>
            ))}
          </Flex>
        </View>
      </AccordionItem>
      <AccordionItem title="Inputs" id="input">
        <View padding="size-200">Inputs go here</View>
      </AccordionItem>
      <AccordionItem title="Output" id="output">
        <View padding="size-200" height="100%">
          <Flex direction="row" gap="size-200">
            {instances.map((instance, i) => (
              <View key={i} flex="1 1 auto">
                <PlaygroundOutput key={i} playgroundInstanceId={instance.id} />
              </View>
            ))}
          </Flex>
        </View>
      </AccordionItem>
    </Accordion>
  );
}
