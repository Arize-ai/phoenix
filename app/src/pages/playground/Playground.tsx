import React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

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
              <Button variant="default" size="compact">
                API Keys
              </Button>
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
    <div
      onClick={(e) => {
        // Stop propagation to prevent the accordion from closing
        e.stopPropagation();
      }}
    >
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
    </div>
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
        <div
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
            .ac-accordion {
              display: flex;
              flex-direction: column;
              height: 100%;
              overflow: hidden;
              flex: 1 1 auto;
              .ac-accordion-item {
                height: 100%;
                overflow: hidden;
                flex: 1 1 auto;
                .ac-accordion-itemContent {
                  height: 100%;
                  overflow: hidden;
                  flex: 1 1 auto;
                  & > * {
                    height: 100%;
                    flex: 1 1 auto;
                    overflow: auto;
                    box-sizing: border-box;
                    // Fix padding issue with flexbox
                    padding-bottom: 57px !important;
                  }
                }
              }
            }
          `}
        >
          <Accordion>
            <AccordionItem
              title="Prompts"
              id="prompts"
              extra={<AddPromptButton />}
            >
              <View padding="size-200" height="100%">
                <PlaygroundTemplate playgroundInstanceId={instanceId} />
              </View>
            </AccordionItem>
          </Accordion>
        </div>
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
      <AccordionItem title="Prompts" id="prompts" extra={<AddPromptButton />}>
        <View height="100%" padding="size-200">
          <Flex direction="row" gap="size-100">
            {instances.map((instance, i) => (
              <div
                key={i}
                css={css`
                  flex: 1 1 0px;
                  max-height: 500px;
                  overflow-y: auto;
                  box-sizing: border-box;
                `}
              >
                <PlaygroundTemplate
                  key={i}
                  playgroundInstanceId={instance.id}
                />
              </div>
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
              <View key={i} flex="1 1 0px">
                <PlaygroundOutput key={i} playgroundInstanceId={instance.id} />
              </View>
            ))}
          </Flex>
        </View>
      </AccordionItem>
    </Accordion>
  );
}
