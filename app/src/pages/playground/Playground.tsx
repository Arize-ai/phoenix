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
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Loading,
  View,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { StopPropagation } from "@phoenix/components/StopPropagation";
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
    <Button
      size="S"
      aria-label="add prompt"
      icon={<Icon svg={<Icons.PlusCircleOutline />} />}
      isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
      onPress={() => {
        addInstance();
      }}
    >
      Compare
    </Button>
  );
}

const playgroundPromptPanelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  & > .rac-disclosure-group {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    & > .rac-disclosure {
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
      .rac-disclosure-panel {
        height: 100%;
        overflow: hidden;
        flex: 1 1 auto;
      }
    }
  }
`;

const promptsWrapCSS = css`
  padding: var(--ac-global-dimension-size-200);
  scrollbar-gutter: stable;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  box-sizing: border-box;
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
            <DisclosureGroup defaultExpandedKeys={["prompts"]}>
              <Disclosure id="prompts" size="L">
                <DisclosureTrigger
                  arrowPosition="start"
                  justifyContent="space-between"
                >
                  Prompts
                  <StopPropagation>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <TemplateLanguageRadioGroup />
                      <AddPromptButton />
                    </Flex>
                  </StopPropagation>
                </DisclosureTrigger>
                <DisclosurePanel>
                  <div css={promptsWrapCSS}>
                    <Flex direction="row" gap="size-200" maxWidth="100%">
                      {instances.map((instance) => (
                        <View
                          flex="1 1 0px"
                          key={instance.id}
                          minWidth={PLAYGROUND_PROMPT_PANEL_MIN_WIDTH}
                        >
                          <PlaygroundTemplate
                            key={instance.id}
                            playgroundInstanceId={instance.id}
                          />
                        </View>
                      ))}
                    </Flex>
                  </div>
                </DisclosurePanel>
              </Disclosure>
            </DisclosureGroup>
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
              <DisclosureGroup defaultExpandedKeys={["input", "output"]}>
                {templateLanguage !== TemplateLanguages.NONE ? (
                  <Disclosure id="input" size="L">
                    <DisclosureTrigger arrowPosition="start">
                      Inputs
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <View padding="size-200" height={"100%"}>
                        <PlaygroundInput />
                      </View>
                    </DisclosurePanel>
                  </Disclosure>
                ) : null}
                <Disclosure id="output" size="L">
                  <DisclosureTrigger arrowPosition="start">
                    Output
                  </DisclosureTrigger>
                  <DisclosurePanel>
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
                  </DisclosurePanel>
                </Disclosure>
              </DisclosureGroup>
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
