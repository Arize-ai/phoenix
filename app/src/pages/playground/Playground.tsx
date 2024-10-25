import React, { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useSearchParams } from "react-router-dom";
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
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { InitialPlaygroundState } from "@phoenix/store";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundCredentialsDropdown } from "./PlaygroundCredentialsDropdown";
import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundInputTypeTypeRadioGroup } from "./PlaygroundInputModeRadioGroup";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundRunButton } from "./PlaygroundRunButton";
import { PlaygroundStreamToggle } from "./PlaygroundStreamToggle";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { TemplateLanguageRadioGroup } from "./TemplateLanguageRadioGroup";

const playgroundWrapCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
`;

export function Playground(props: InitialPlaygroundState) {
  const showStreamToggle = useFeatureFlag("playgroundNonStreaming");
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    setSearchParams(
      (searchParams) => {
        // remove lingering selectedSpanNodeId param so as to not poison the trace details slideover
        // with stale data from previous pages
        searchParams.delete("selectedSpanNodeId");
        return searchParams;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  return (
    <PlaygroundProvider {...props}>
      <div css={playgroundWrapCSS}>
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
              {showStreamToggle ? <PlaygroundStreamToggle /> : null}
              <PlaygroundCredentialsDropdown />
              <PlaygroundRunButton />
            </Flex>
          </Flex>
        </View>
        <PlaygroundContent />
      </div>
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

const playgroundPromptPanelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  & > .ac-accordion {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    & > .ac-accordion-item {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1 1 auto;
      .ac-accordion-itemContent {
        height: 100%;
        overflow: hidden;
        flex: 1 1 auto;
        & > .ac-view {
          height: 100%;
          flex: 1 1 auto;
          overflow: auto;
          box-sizing: border-box;
        }
      }
    }
  }
`;

const playgroundInputOutputPanelContentCSS = css`
  height: 100%;
  overflow: auto;
`;

function PlaygroundContent() {
  const playgroundWithDatasetsEnabled = useFeatureFlag(
    "playgroundWithDatasets"
  );
  const instances = usePlaygroundContext((state) => state.instances);
  const numInstances = instances.length;
  const isSingleInstance = numInstances === 1;

  return (
    <PanelGroup
      direction={isSingleInstance ? "horizontal" : "vertical"}
      autoSaveId={
        isSingleInstance ? "playground-horizontal" : "playground-vertical"
      }
    >
      <Panel>
        <div css={playgroundPromptPanelContentCSS}>
          <Accordion arrowPosition="start" size="L">
            <AccordionItem
              title="Prompts"
              id="prompts"
              extra={
                <Flex direction="row" gap="size-100" alignItems="center">
                  <TemplateLanguageRadioGroup />
                  <AddPromptButton />
                </Flex>
              }
            >
              <View height="100%" padding="size-200">
                <Flex direction="row" gap="size-200">
                  {instances.map((instance) => (
                    <View key={instance.id} flex="1 1 0px">
                      <PlaygroundTemplate
                        key={instance.id}
                        playgroundInstanceId={instance.id}
                      />
                    </View>
                  ))}
                </Flex>
              </View>
            </AccordionItem>
          </Accordion>
        </div>
      </Panel>
      <PanelResizeHandle css={resizeHandleCSS} />
      <Panel>
        <div css={playgroundInputOutputPanelContentCSS}>
          <Accordion arrowPosition="start" size="L">
            <AccordionItem
              title="Inputs"
              id="input"
              extra={
                playgroundWithDatasetsEnabled ? (
                  <PlaygroundInputTypeTypeRadioGroup />
                ) : null
              }
            >
              <View padding="size-200" height={"100%"}>
                <PlaygroundInput />
              </View>
            </AccordionItem>
            <AccordionItem title="Output" id="output">
              <View padding="size-200" height="100%">
                <Flex direction="row" gap="size-200">
                  {instances.map((instance, i) => (
                    <View key={i} flex="1 1 0px">
                      <PlaygroundOutput
                        key={i}
                        playgroundInstanceId={instance.id}
                      />
                    </View>
                  ))}
                </Flex>
              </View>
            </AccordionItem>
          </Accordion>
        </div>
      </Panel>
    </PanelGroup>
  );
}
