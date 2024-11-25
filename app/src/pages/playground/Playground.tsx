import React, { Suspense, useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  BlockerFunction,
  Outlet,
  useBlocker,
  useParams,
  useSearchParams,
} from "react-router-dom";
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

import { Loading } from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { PlaygroundProps } from "@phoenix/store";

import { PlaygroundQuery } from "./__generated__/PlaygroundQuery.graphql";
import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { NoInstalledProvider } from "./NoInstalledProvider";
import { PlaygroundCredentialsDropdown } from "./PlaygroundCredentialsDropdown";
import { PlaygroundDatasetPicker } from "./PlaygroundDatasetPicker";
import { PlaygroundDatasetSection } from "./PlaygroundDatasetSection";
import { PlaygroundInput } from "./PlaygroundInput";
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

export function Playground(props: Partial<PlaygroundProps>) {
  const { modelProviders } = useLazyLoadQuery<PlaygroundQuery>(
    graphql`
      query PlaygroundQuery {
        modelProviders {
          name
          dependenciesInstalled
          dependencies
        }
      }
    `,
    {}
  );
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  const playgroundStreamingEnabled = usePreferencesContext(
    (state) => state.playgroundStreamingEnabled
  );
  const [, setSearchParams] = useSearchParams();
  const hasInstalledProvider = modelProviders.some(
    (provider) => provider.dependenciesInstalled
  );

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

  const streaming = window.Config.websocketsEnabled
    ? playgroundStreamingEnabled
    : false;

  const showStreamingToggle = window.Config.websocketsEnabled;

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }

  return (
    <PlaygroundProvider
      {...props}
      streaming={streaming}
      modelConfigByProvider={modelConfigByProvider}
    >
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
              {showStreamingToggle ? <PlaygroundStreamToggle /> : null}
              <PlaygroundDatasetPicker />
              <PlaygroundCredentialsDropdown />
              <PlaygroundRunButton />
            </Flex>
          </Flex>
        </View>
        <PlaygroundContent />
      </div>
      <Suspense>
        <Outlet />
      </Suspense>
    </PlaygroundProvider>
  );
}

function AddPromptButton() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);
  const instances = usePlaygroundContext((state) => state.instances);
  const numInstances = instances.length;
  const isRunning = instances.some((instance) => instance.activeRunId != null);
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
        disabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
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
      overflow-x: hidden;
      overflow-y: auto;
      flex: 1 1 auto;
      // prevent the accordion item header from growing to fill the accordion item
      // using two selectors as fallback just incase the component lib changes subtly
      & > [role="button"],
      & > #prompts-heading {
        flex: 0 0 auto;
      }
      .ac-accordion-itemContent {
        height: 100%;
        overflow: hidden;
        flex: 1 1 auto;
        & > .ac-view {
          // add scrollbar gutter to the right of the accordion item
          scrollbar-gutter: stable;
          // if scrollbar-gutter is not supported, add padding to the right of the accordion item
          @supports not (scrollbar-gutter: stable) {
            padding-right: 16px;
          }
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

/**
 * This width accomodates the model config button min-width, as well as chat message accordion
 * header contents such as the chat message mode radio group for AI messages
 */
const PLAYGROUND_PROMPT_PANEL_MIN_WIDTH = 475;

function PlaygroundContent() {
  const instances = usePlaygroundContext((state) => state.instances);
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const { datasetId } = useParams<{ datasetId: string }>();
  const isDatasetMode = datasetId != null;
  const numInstances = instances.length;
  const isSingleInstance = numInstances === 1;
  const isRunning = instances.some((instance) => instance.activeRunId != null);

  // Handles blocking navigation when a run is in progress
  const shouldBlockUnload = useCallback(
    ({ currentLocation, nextLocation }: Parameters<BlockerFunction>[0]) => {
      return isRunning && currentLocation.pathname !== nextLocation.pathname;
    },
    [isRunning]
  );
  const blocker = useBlocker(shouldBlockUnload);

  // Handles blocking page reloads when a run is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning) {
        e.preventDefault();
        // This is deprecated but still necessary for cross-browser compatibility
        e.returnValue = true;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  return (
    <>
      <PanelGroup
        direction={
          isSingleInstance && !isDatasetMode ? "horizontal" : "vertical"
        }
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
                {/* No padding on the right of the accordion item, it is handled by the stable scrollbar gutter */}
                <View height="100%" paddingY="size-200" paddingStart="size-200">
                  <Flex direction="row" gap="size-200" maxWidth="100%">
                    {instances.map((instance) => (
                      <View
                        key={instance.id}
                        minWidth={PLAYGROUND_PROMPT_PANEL_MIN_WIDTH}
                        flex="1 1 0px"
                      >
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
          {isDatasetMode ? (
            <Suspense fallback={<Loading />}>
              <PlaygroundDatasetSection datasetId={datasetId} />
            </Suspense>
          ) : (
            <div css={playgroundInputOutputPanelContentCSS}>
              <Accordion arrowPosition="start" size="L">
                {templateLanguage !== TemplateLanguages.NONE ? (
                  <AccordionItem title="Inputs" id="input">
                    <View padding="size-200" height={"100%"}>
                      <PlaygroundInput />
                    </View>
                  </AccordionItem>
                ) : null}
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
          )}
        </Panel>
      </PanelGroup>
      {blocker != null && (
        <ConfirmNavigationDialog
          blocker={blocker}
          message="Playground run is still in progress, leaving the page may result in incomplete runs. Are you sure you want to leave?"
        />
      )}
    </>
  );
}
