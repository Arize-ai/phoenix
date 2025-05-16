import { Fragment, Suspense, useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { BlockerFunction, useBlocker, useSearchParams } from "react-router";
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
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { PlaygroundExamplePage } from "@phoenix/pages/playground/PlaygroundExamplePage";
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
import { TemplateFormatRadioGroup } from "./TemplateFormatRadioGroup";

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
  const hasInstalledProvider = modelProviders.some(
    (provider) => provider.dependenciesInstalled
  );

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }
  return (
    <PlaygroundProvider
      {...props}
      streaming={playgroundStreamingEnabled}
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
              <PlaygroundStreamToggle />
              <PlaygroundDatasetPicker />
              <PlaygroundCredentialsDropdown />
              <PlaygroundRunButton />
            </Flex>
          </Flex>
        </View>
        <PlaygroundContent />
      </div>
      <Suspense>
        <PlaygroundExamplePage />
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
      leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
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
  & > .ac-disclosure-group {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    & > .ac-disclosure {
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
      .ac-disclosure-panel {
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
const PLAYGROUND_PROMPT_PANEL_MIN_WIDTH = 632;

const DEFAULT_EXPANDED_PROMPTS = ["prompts"];
const DEFAULT_EXPANDED_PARAMS = ["input", "output"];

function PlaygroundContent() {
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get("datasetId");
  const isDatasetMode = datasetId != null;
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const isSingleInstance = numInstances === 1;
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const anyDirtyPromptInstances = usePlaygroundContext((state) =>
    Object.values(state.dirtyInstances).some((dirty) => dirty)
  );
  const instanceIds = usePlaygroundContext(
    (state) => state.instances.map((instance) => instance.id),
    // only re-render when the instance ids change, not when the array is re-created
    (left, right) =>
      left.length === right.length &&
      left.every((id, index) => id === right[index])
  );

  // Soft block at the router level when a run is in progress or there are dirty instances
  // Handles blocking navigation when a run is in progress
  const shouldBlockUnload = useCallback(
    ({ currentLocation, nextLocation }: Parameters<BlockerFunction>[0]) => {
      const goingToNewPage = currentLocation.pathname !== nextLocation.pathname;
      return (isRunning || anyDirtyPromptInstances) && goingToNewPage;
    },
    [isRunning, anyDirtyPromptInstances]
  );
  const blocker = useBlocker(shouldBlockUnload);

  // Hard block at the browser level when a run is in progress
  // Handles blocking page reloads when a run is in progress
  useEffect(() => {
    const shouldBlock = isRunning;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // This is deprecated but still necessary for cross-browser compatibility
      e.returnValue = true;
    };

    if (shouldBlock) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [isRunning]);

  return (
    <Fragment key="playground-content">
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
            <DisclosureGroup defaultExpandedKeys={DEFAULT_EXPANDED_PROMPTS}>
              <Disclosure id="prompts" size="L">
                <DisclosureTrigger
                  arrowPosition="start"
                  justifyContent="space-between"
                >
                  Prompts
                  <StopPropagation>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <TemplateFormatRadioGroup size="S" />
                      <AddPromptButton />
                    </Flex>
                  </StopPropagation>
                </DisclosureTrigger>
                <DisclosurePanel>
                  <div css={promptsWrapCSS}>
                    <Flex direction="row" gap="size-200" maxWidth="100%">
                      {instanceIds.map((instanceId) => (
                        <View
                          flex="1 1 0px"
                          key={`${instanceId}-prompt`}
                          minWidth={PLAYGROUND_PROMPT_PANEL_MIN_WIDTH}
                        >
                          <PlaygroundTemplate
                            playgroundInstanceId={instanceId}
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
        <PanelResizeHandle css={compactResizeHandleCSS} />
        <Panel>
          {isDatasetMode ? (
            <Suspense fallback={<Loading />}>
              <PlaygroundDatasetSection datasetId={datasetId} />
            </Suspense>
          ) : (
            <div css={playgroundInputOutputPanelContentCSS}>
              <DisclosureGroup defaultExpandedKeys={DEFAULT_EXPANDED_PARAMS}>
                {templateFormat !== TemplateFormats.NONE ? (
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
                        {instanceIds.map((instanceId) => (
                          <View key={`${instanceId}-output`} flex="1 1 0px">
                            <PlaygroundOutput
                              playgroundInstanceId={instanceId}
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
          message={
            isRunning
              ? "Playground run is still in progress, leaving the page may result in incomplete runs. Are you sure you want to leave?"
              : "You have unsaved changes. Are you sure you want to leave?"
          }
        />
      )}
    </Fragment>
  );
}
