import { css } from "@emotion/react";
import { useResizeObserver } from "@react-aria/utils";
import { useLayoutEffect, useRef, useState } from "react";
import { graphql, useLazyLoadQuery, usePreloadedQuery } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useLoaderData } from "react-router";

import {
  Button,
  DialogTrigger,
  Flex,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePreferencesContext } from "@phoenix/contexts";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import {
  useOwnedPreloadedQuery,
  useUnsavedChangesBlocker,
} from "@phoenix/hooks";
import { promptVersionToInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { NoInstalledProvider } from "@phoenix/pages/playground/NoInstalledProvider";
import { PlaygroundCredentialsDropdown } from "@phoenix/pages/playground/PlaygroundCredentialsDropdown";
import {
  PlaygroundInstanceModelControls,
  PlaygroundTemplate,
} from "@phoenix/pages/playground/PlaygroundTemplate";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";
import { generateInstanceId } from "@phoenix/store";

import type { PromptIndexPageQuery } from "./__generated__/PromptIndexPageQuery.graphql";
import type { promptLoaderQuery as PromptLoaderQuery } from "./__generated__/promptLoaderQuery.graphql";
import type {
  promptVersionLoaderQuery as PromptVersionLoaderQuery,
  promptVersionLoaderQuery$data,
} from "./__generated__/promptVersionLoaderQuery.graphql";
import {
  PROMPT_CHAT_MAX_WIDTH,
  PROMPT_CHAT_MIN_WIDTH,
  PromptChat,
} from "./PromptChat";
import { promptLoaderQuery } from "./promptLoader";
import { PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH } from "./promptPageLayout";
import type { PromptVersionLoaderData } from "./promptVersionLoader";
import { promptVersionLoaderQuery } from "./promptVersionLoader";
import { SavePromptVersionDialog } from "./SavePromptVersionDialog";
import { usePromptIdLoader } from "./usePromptIdLoader";
import { usePromptPlaygroundChat } from "./usePromptPlaygroundChat";

const PROMPT_EDITOR_MIN_WIDTH = 420;

/**
 * Below this width the editor and chat cannot both fit, so the chat is hidden
 */
const PROMPT_CHAT_VISIBLE_MIN_WIDTH =
  PROMPT_EDITOR_MIN_WIDTH + PROMPT_CHAT_MIN_WIDTH;

const promptIndexPageCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  & > * {
    flex: 1 1 auto;
    min-width: 0;
  }
  .prompt-index-page__chat {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-inline-start: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }
`;

/**
 * The prompt's latest version, editable as in the playground, beside a chat
 * with the prompt as edited. Saving creates the prompt's next version.
 */
export function PromptIndexPage() {
  const loaderData = useLoaderData<PromptVersionLoaderData>();
  const { promptVersion } = useOwnedPreloadedQuery<PromptVersionLoaderQuery>({
    query: promptVersionLoaderQuery,
    queryRef: loaderData.queryRef,
  });
  const promptData = usePreloadedQuery<PromptLoaderQuery>(
    promptLoaderQuery,
    usePromptIdLoader().queryRef
  );
  const { modelProviders } = useLazyLoadQuery<PromptIndexPageQuery>(
    graphql`
      query PromptIndexPageQuery {
        modelProviders {
          name
          dependenciesInstalled
          dependencies
        }
      }
    `,
    {}
  );
  if (!modelProviders.some((provider) => provider.dependenciesInstalled)) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }
  return (
    <PromptPlayground
      key={promptData.prompt.id}
      promptId={promptData.prompt.id}
      promptName={promptData.prompt.name ?? ""}
      promptVersion={promptVersion}
    />
  );
}

/**
 * Seeds the playground from the version the page first loads. A saved
 * version leaves the edited prompt in place rather than reseeding it.
 */
function PromptPlayground({
  promptId,
  promptName,
  promptVersion,
}: {
  promptId: string;
  promptName: string;
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );
  const streaming = usePreferencesContext(
    (state) => state.playgroundStreamingEnabled
  );
  const [initialState] = useState(() => {
    const instance = {
      ...promptVersionToInstance({
        promptId,
        promptName,
        promptVersionRef: promptVersion,
        promptVersionTag: null,
      }),
      id: generateInstanceId(),
    };
    return {
      instances: [instance],
      templateFormat: promptVersion.templateFormat as TemplateFormat,
    };
  });
  return (
    <PlaygroundProvider
      instances={initialState.instances}
      templateFormat={initialState.templateFormat}
      modelConfigByProvider={modelConfigByProvider}
      streaming={streaming}
    >
      <PromptPlaygroundLayout
        promptId={promptId}
        instanceId={initialState.instances[0].id}
        savedTemplateFormat={initialState.templateFormat}
      />
    </PlaygroundProvider>
  );
}

function PromptPlaygroundLayout({
  promptId,
  instanceId,
  savedTemplateFormat: initialSavedTemplateFormat,
}: {
  promptId: string;
  instanceId: number;
  savedTemplateFormat: TemplateFormat;
}) {
  const [savedTemplateFormat, setSavedTemplateFormat] = useState(
    initialSavedTemplateFormat
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const isInstanceDirty = usePlaygroundContext(
    (state) => state.dirtyInstances[instanceId] ?? false
  );
  const hasUnsavedChanges =
    isInstanceDirty || templateFormat !== savedTemplateFormat;
  const blocker = useUnsavedChangesBlocker({ hasUnsavedChanges });
  // The conversation lives here so that it survives the chat being hidden
  const chat = usePromptPlaygroundChat({ instanceId });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const measureContainer = () => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  };
  useLayoutEffect(measureContainer, []);
  useResizeObserver({ ref: containerRef, onResize: measureContainer });
  const showsChat =
    containerWidth != null && containerWidth >= PROMPT_CHAT_VISIBLE_MIN_WIDTH;
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "prompt-index-page-panels",
    panelIds: ["prompt-index-page-prompt", "prompt-index-page-chat"],
    storage: localStorage,
  });
  const editor = (
    <View height="100%" overflow="auto" data-testid="scroll-container">
      <View padding="size-200">
        <Flex
          direction="column"
          gap="size-100"
          marginStart="auto"
          marginEnd="auto"
          maxWidth={PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH}
        >
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            justifyContent="space-between"
          >
            <Flex direction="row" gap="size-100" alignItems="center">
              <PlaygroundInstanceModelControls
                playgroundInstanceId={instanceId}
              />
              <PlaygroundCredentialsDropdown />
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="center">
              <TemplateFormatRadioGroup size="S" />
              <DialogTrigger>
                <Button
                  size="S"
                  variant={hasUnsavedChanges ? "primary" : "default"}
                >
                  Save Version
                </Button>
                <ViewportModalOverlay>
                  <ViewportModal size="M">
                    <SavePromptVersionDialog
                      promptId={promptId}
                      instanceId={instanceId}
                      onSaved={() => setSavedTemplateFormat(templateFormat)}
                    />
                  </ViewportModal>
                </ViewportModalOverlay>
              </DialogTrigger>
            </Flex>
          </Flex>
          <PlaygroundTemplate
            playgroundInstanceId={instanceId}
            availablePaths={undefined}
            disableHeader
            disablePromptMenu
            disablePromptSave
            disableAlphabeticIndex
          />
        </Flex>
      </View>
    </View>
  );
  return (
    <div css={promptIndexPageCSS} ref={containerRef}>
      {showsChat ? (
        <Group
          id="prompt-index-page-panels"
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id="prompt-index-page-prompt"
            minSize={`${PROMPT_EDITOR_MIN_WIDTH}px`}
          >
            {editor}
          </Panel>
          <Separator css={compactResizeHandleCSS} />
          <Panel
            id="prompt-index-page-chat"
            defaultSize="40%"
            minSize={`${PROMPT_CHAT_MIN_WIDTH}px`}
            maxSize={`${PROMPT_CHAT_MAX_WIDTH}px`}
            className="prompt-index-page__chat"
          >
            <PromptChat instanceId={instanceId} chat={chat} />
          </Panel>
        </Group>
      ) : (
        editor
      )}
      <ConfirmNavigationDialog
        blocker={blocker}
        message="This prompt has unsaved changes. Are you sure you want to leave?"
      />
    </div>
  );
}
