import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  TextField,
  View,
} from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { DragHandle } from "@phoenix/components/dnd";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { validateMustacheSections } from "@phoenix/components/templateEditor/language/mustacheLike";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { createToolCallForProvider } from "@phoenix/pages/playground/playgroundUtils";
import type { ChatMessage, PlaygroundState } from "@phoenix/store";
import { convertMessageToolCallsToProvider } from "@phoenix/store/playground/playgroundStoreUtils";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceMessage,
} from "@phoenix/store/playground/selectors";
import { assertUnreachable } from "@phoenix/typeUtils";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

import { ChatMessageToolCallsEditor } from "./ChatMessageToolCallsEditor";
import type { AIMessageMode, MessageMode } from "./MessageContentRadioGroup";
import { AIMessageContentRadioGroup } from "./MessageContentRadioGroup";
import { getMessagePreview } from "./messagePreview";
import { MessageRoleSelect } from "./MessageRoleSelect";

/**
 * The z-index of the dragging message.
 * Only applied when actively dragging to ensure the dragged message appears above others.
 * Non-dragging messages should NOT have a z-index to avoid creating stacking contexts
 * that would clip autocomplete dropdowns.
 */
const DRAGGING_MESSAGE_Z_INDEX = 10;

const messageListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

type ChatTemplateMessagesProps = {
  playgroundInstanceId: number;
  /** Dataset paths the message editors can autocomplete. */
  availablePaths: string[] | undefined;
  /** A dataset path whose messages are appended after these at run time. */
  appendedMessagesPath?: string | null;
};

/**
 * The sortable, editable message list of an instance's chat template.
 */
export function ChatTemplateMessages({
  playgroundInstanceId,
  availablePaths,
  appendedMessagesPath,
}: ChatTemplateMessagesProps) {
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const playgroundInstance = usePlaygroundContext(
    selectPlaygroundInstance(playgroundInstanceId)
  );
  if (!playgroundInstance) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }
  const { template } = playgroundInstance;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  const messageIds = template.messageIds;

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const newMessageIds = move(messageIds, event);
        if (newMessageIds === messageIds) {
          return;
        }
        updateInstance({
          instanceId: playgroundInstanceId,
          patch: {
            template: {
              __type: "chat",
              messageIds: newMessageIds,
            },
          },
          dirty: true,
        });
      }}
    >
      <ul css={messageListCSS}>
        {messageIds.map((messageId, messageIndex) => {
          return (
            <SortableMessageItem
              availablePaths={availablePaths}
              playgroundInstanceId={playgroundInstanceId}
              templateFormat={templateFormat}
              key={messageId}
              messageId={messageId}
              messageIndex={messageIndex}
            />
          );
        })}
      </ul>
      {appendedMessagesPath ? (
        <View paddingTop="size-100" paddingBottom="size-100">
          <Alert variant="info">
            Messages from the configured path{" "}
            <strong>{appendedMessagesPath}</strong> will be appended to this
            prompt.
          </Alert>
        </View>
      ) : null}
    </DragDropProvider>
  );
}

function MessageEditor({
  message,
  updateMessage,
  templateFormat,
  playgroundInstanceId,
  messageMode,
  availablePaths,
}: {
  playgroundInstanceId: number;
  message: ChatMessage;
  templateFormat: TemplateFormat;
  updateMessage: (patch: Partial<ChatMessage>) => void;
  messageMode: MessageMode;
  availablePaths?: string[];
}) {
  // Track whether to show validation alerts - becomes true on first blur
  // and stays true so errors remain visible until fixed
  const [showValidation, setShowValidation] = useState(false);

  const onChange = useCallback(
    (val: string) => {
      updateMessage({ content: val });
    },
    [updateMessage]
  );
  const onBlur = useCallback(() => setShowValidation(true), []);
  const sectionValidation = useMemo(() => {
    if (templateFormat !== TemplateFormats.Mustache) {
      return null;
    }
    return validateMustacheSections(message.content ?? "");
  }, [message.content, templateFormat]);
  if (messageMode === "toolCalls") {
    return (
      <View
        paddingTop="size-100"
        paddingStart="size-250"
        paddingEnd="size-250"
        paddingBottom="size-200"
      >
        <div css={fieldBaseCSS}>
          <Label>Tool Calls</Label>
          <CodeWrap style={{ width: "100%" }}>
            <ChatMessageToolCallsEditor
              playgroundInstanceId={playgroundInstanceId}
              messageId={message.id}
            />
          </CodeWrap>
        </div>
      </View>
    );
  }
  if (message.role === "tool") {
    return (
      <Form
        onSubmit={(e) => {
          // Block default form submission to prevent page from refreshing
          e.preventDefault();
        }}
      >
        <View
          paddingX="size-200"
          paddingY="size-100"
          borderColor="yellow-700"
          borderBottomWidth="thin"
        >
          <TextField
            value={message.toolCallId}
            onChange={(val) => updateMessage({ toolCallId: val })}
            aria-label="Tool Call ID"
            size="S"
          >
            <Input placeholder="Tool Call ID" />
          </TextField>
        </View>
        <JSONEditor
          value={message.content ?? '""'}
          aria-label="tool message content"
          height={"100%"}
          onChange={(val) => updateMessage({ content: val })}
        />
      </Form>
    );
  }

  return (
    <TemplateEditorWrap>
      {showValidation && sectionValidation?.errors.length ? (
        <Alert variant="danger" banner title="Invalid mustache sections">
          {sectionValidation.errors.join(", ")}
        </Alert>
      ) : null}
      {showValidation && sectionValidation?.warnings.length ? (
        <Alert variant="warning" banner title="Unclosed mustache sections">
          {sectionValidation.warnings.join(", ")}
        </Alert>
      ) : null}
      <TemplateEditor
        height="100%"
        defaultValue={message.content || ""}
        aria-label="Message content"
        templateFormat={templateFormat}
        onChange={onChange}
        onBlur={onBlur}
        availablePaths={availablePaths}
      />
    </TemplateEditorWrap>
  );
}

function SortableMessageItem({
  playgroundInstanceId,
  templateFormat,
  messageId,
  messageIndex,
  availablePaths,
}: {
  playgroundInstanceId: number;
  messageId: number;
  messageIndex: number;
  templateFormat: TemplateFormat;
  availablePaths: string[] | undefined;
}) {
  const updateMessage = usePlaygroundContext((state) => state.updateMessage);
  const deleteMessage = usePlaygroundContext((state) => state.deleteMessage);
  const sortable = useSortable({
    id: messageId,
    index: messageIndex,
  });
  const instanceModelSelector = useMemo(
    () => (state: PlaygroundState) =>
      state.instances.find((instance) => instance.id === playgroundInstanceId)
        ?.model,
    [playgroundInstanceId]
  );
  const instanceModel = usePlaygroundContext(instanceModelSelector);
  if (!instanceModel) {
    throw new Error(
      `Instance model not found for instance ${playgroundInstanceId}`
    );
  }
  const messageSelector = useMemo(
    () => selectPlaygroundInstanceMessage(messageId),
    [messageId]
  );
  const message = usePlaygroundContext(messageSelector);
  const externalMessageRevision = usePlaygroundContext(
    (state) => state.externallyUpdatedMessageRevisionById[messageId] ?? 0
  );
  const messageCardStyles = useChatMessageStyles(message.role);
  const dragAndDropLiStyles = {
    // Only set z-index when dragging to avoid creating stacking contexts
    // that would clip autocomplete dropdowns
    zIndex: sortable.isDragging ? DRAGGING_MESSAGE_Z_INDEX : undefined,
  };

  const hasTools = message.toolCalls != null && message.toolCalls.length > 0;

  const [aiMessageMode, setAIMessageMode] = useState<AIMessageMode>(
    hasTools ? "toolCalls" : "text"
  );

  // Preserves the content of the message before switching message modes
  // Enables the user to switch back to text mode and restore the previous content
  const [previousMessageContent, setPreviousMessageContent] = useState<
    ChatMessage["content"]
  >(message.content);
  // Preserves the tool calls of the message before switching message modes
  // Enables the user to switch back to text mode and restore the previous tool calls
  const [previousMessageToolCalls, setPreviousMessageToolCalls] = useState<
    ChatMessage["toolCalls"]
  >(message.toolCalls);

  const onMessageUpdate = useCallback(
    (patch: Partial<ChatMessage>) => {
      updateMessage({
        instanceId: playgroundInstanceId,
        messageId,
        patch,
      });
    },
    [playgroundInstanceId, messageId, updateMessage]
  );

  /* eslint-disable react/refs */
  return (
    <li ref={sortable.ref} style={dragAndDropLiStyles}>
      <Card
        collapsible
        interactiveTitle
        collapseButtonLabel={`${message.role} message`}
        headerContent={
          <CardCollapsedPreview>
            {getMessagePreview(message)}
          </CardCollapsedPreview>
        }
        {...messageCardStyles}
        title={
          <MessageRoleSelect
            includeLabel={false}
            role={message.role}
            onChange={(role) => {
              let content = message.content;
              let toolCalls = message.toolCalls;
              // Tool calls should only be attached to ai messages
              // Clear tools from the message and reset the message mode when switching away form ai
              if (role !== "ai") {
                toolCalls = undefined;
                setAIMessageMode("text");
              }
              // Tool role messages should contain tool result content
              // Reset the content to an empty json string
              if (role === "tool") {
                content = `""`;
              }
              updateMessage({
                instanceId: playgroundInstanceId,
                messageId,
                patch: {
                  role,
                  toolCalls,
                  content,
                },
              });
            }}
          />
        }
        extra={
          <Flex direction="row" gap="size-100">
            {
              // Only show tool calls option for AI messages
              message.role === "ai" ? (
                <AIMessageContentRadioGroup
                  messageMode={aiMessageMode}
                  onChange={(mode) => {
                    setAIMessageMode(mode);
                    switch (mode) {
                      case "text":
                        setPreviousMessageToolCalls(message.toolCalls);
                        updateMessage({
                          instanceId: playgroundInstanceId,
                          messageId,
                          patch: {
                            content: previousMessageContent,
                            toolCalls: undefined,
                          },
                        });
                        break;
                      case "toolCalls":
                        setPreviousMessageContent(message.content);
                        updateMessage({
                          instanceId: playgroundInstanceId,
                          messageId,
                          patch: {
                            content: "",
                            toolCalls:
                              previousMessageToolCalls != null
                                ? convertMessageToolCallsToProvider({
                                    toolCalls: previousMessageToolCalls,
                                    provider: instanceModel.provider,
                                  })
                                : [
                                    createToolCallForProvider(
                                      instanceModel.provider
                                    ),
                                  ],
                          },
                        });
                        break;
                      default:
                        assertUnreachable(mode);
                    }
                  }}
                />
              ) : null
            }
            <CopyToClipboardButton
              text={
                aiMessageMode === "toolCalls"
                  ? (safelyStringifyJSON(message.toolCalls).json ?? "")
                  : (message.content ?? "")
              }
            />
            <Button
              aria-label="Delete message"
              leadingVisual={<Icon svg={<Icons.Trash />} />}
              size="S"
              onPress={() => {
                deleteMessage({
                  instanceId: playgroundInstanceId,
                  messageId,
                });
              }}
            />
            <DragHandle ref={sortable.handleRef} aria-label="Reorder message" />
          </Flex>
        }
      >
        <div>
          <MessageEditor
            // TemplateEditor is intentionally uncontrolled. External PXI edits
            // bump this revision so accepted changes remount the editor without
            // remounting on every local keystroke.
            key={`${message.id}-${templateFormat}-${externalMessageRevision}`}
            message={message}
            messageMode={aiMessageMode}
            playgroundInstanceId={playgroundInstanceId}
            templateFormat={templateFormat}
            updateMessage={onMessageUpdate}
            availablePaths={availablePaths}
          />
        </div>
      </Card>
    </li>
  );
  /* eslint-enable react/refs */
}
