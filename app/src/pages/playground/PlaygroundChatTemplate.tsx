import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { css } from "@emotion/react";

import { Card, Field, Form } from "@arizeai/components";

import {
  Button,
  CopyToClipboardButton,
  DisclosureGroup,
  Flex,
  Icon,
  Icons,
  Input,
  TextField,
  View,
} from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { DragHandle } from "@phoenix/components/dnd/DragHandle";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { ChatMessage, PlaygroundState } from "@phoenix/store";
import { convertMessageToolCallsToProvider } from "@phoenix/store/playground/playgroundStoreUtils";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceMessage,
} from "@phoenix/store/playground/selectors";
import { assertUnreachable } from "@phoenix/typeUtils";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

import { ChatMessageToolCallsEditor } from "./ChatMessageToolCallsEditor";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
} from "./constants";
import {
  AIMessageContentRadioGroup,
  AIMessageMode,
  MessageMode,
} from "./MessageContentRadioGroup";
import { MessageRolePicker } from "./MessageRolePicker";
import { PlaygroundChatTemplateFooter } from "./PlaygroundChatTemplateFooter";
import { PlaygroundResponseFormat } from "./PlaygroundResponseFormat";
import { PlaygroundTools } from "./PlaygroundTools";
import {
  areInvocationParamsEqual,
  createToolCallForProvider,
} from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

const MESSAGE_Z_INDEX = 1;
/**
 * The z-index of the dragging message.
 * Must be higher than the z-index of the other messages. Otherwise when dragging
 * from top to bottom, the dragging message will be covered by the message below.
 */
const DRAGGING_MESSAGE_Z_INDEX = MESSAGE_Z_INDEX + 1;

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const id = props.playgroundInstanceId;

  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instanceSelector = useMemo(() => selectPlaygroundInstance(id), [id]);
  const playgroundInstance = usePlaygroundContext(instanceSelector);
  if (!playgroundInstance) {
    throw new Error(`Playground instance ${id} not found`);
  }

  const hasTools = playgroundInstance.tools.length > 0;
  const hasResponseFormat =
    playgroundInstance.model.invocationParameters.find((p) =>
      areInvocationParamsEqual(p, {
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
      })
    ) != null;
  const { template } = playgroundInstance;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  const messageIds = template.messageIds;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) {
          return;
        }
        const activeIndex = messageIds.findIndex(
          (messageId) => messageId === active.id
        );
        const overIndex = messageIds.findIndex(
          (messageId) => messageId === over.id
        );
        const newMessageIds = arrayMove(messageIds, activeIndex, overIndex);
        updateInstance({
          instanceId: id,
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
      <SortableContext items={messageIds}>
        <ul
          css={css`
            display: flex;
            flex-direction: column;
            gap: var(--ac-global-dimension-size-200);
            padding: var(--ac-global-dimension-size-200);
          `}
        >
          {messageIds.map((messageId) => {
            return (
              <SortableMessageItem
                playgroundInstanceId={id}
                templateFormat={templateFormat}
                key={messageId}
                messageId={messageId}
              />
            );
          })}
        </ul>
      </SortableContext>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderColor="dark"
        borderTopWidth="thin"
        borderBottomWidth={hasTools || hasResponseFormat ? "thin" : undefined}
      >
        <PlaygroundChatTemplateFooter
          instanceId={id}
          hasResponseFormat={hasResponseFormat}
        />
      </View>
      {hasTools || hasResponseFormat ? (
        <DisclosureGroup defaultExpandedKeys={["tools", "response-format"]}>
          {hasTools ? <PlaygroundTools {...props} /> : null}
          {hasResponseFormat ? <PlaygroundResponseFormat {...props} /> : null}
        </DisclosureGroup>
      ) : null}
    </DndContext>
  );
}

function MessageEditor({
  message,
  updateMessage,
  templateFormat,
  playgroundInstanceId,
  messageMode,
}: {
  playgroundInstanceId: number;
  message: ChatMessage;
  templateFormat: TemplateFormat;
  updateMessage: (patch: Partial<ChatMessage>) => void;
  messageMode: MessageMode;
}) {
  const onChange = useCallback(
    (val: string) => {
      updateMessage({ content: val });
    },
    [updateMessage]
  );
  if (messageMode === "toolCalls") {
    return (
      <View
        paddingTop="size-100"
        paddingStart="size-250"
        paddingEnd="size-250"
        paddingBottom="size-200"
      >
        <Field label={"Tool Calls"}>
          <CodeWrap width={"100%"}>
            <ChatMessageToolCallsEditor
              playgroundInstanceId={playgroundInstanceId}
              messageId={message.id}
            />
          </CodeWrap>
        </Field>
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
      <TemplateEditor
        height="100%"
        defaultValue={message.content || ""}
        aria-label="Message content"
        templateFormat={templateFormat}
        onChange={onChange}
      />
    </TemplateEditorWrap>
  );
}

function SortableMessageItem({
  playgroundInstanceId,
  templateFormat,
  messageId,
}: PropsWithChildren<{
  playgroundInstanceId: number;
  messageId: number;
  templateFormat: TemplateFormat;
}>) {
  const updateMessage = usePlaygroundContext((state) => state.updateMessage);
  const deleteMessage = usePlaygroundContext((state) => state.deleteMessage);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({
    id: messageId,
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
  const messageCardStyles = useChatMessageStyles(message.role);
  const dragAndDropLiStyles = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? DRAGGING_MESSAGE_Z_INDEX : MESSAGE_Z_INDEX,
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

  return (
    <li ref={setNodeRef} style={dragAndDropLiStyles}>
      <Card
        collapsible
        variant="compact"
        bodyStyle={{ padding: 0 }}
        {...messageCardStyles}
        title={
          <div
            css={css`
              // Align the role picker with the prompt picker in PlaygroundTemplate header
              margin-left: var(--ac-global-dimension-size-150);
            `}
          >
            <MessageRolePicker
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
          </div>
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
              leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
              size="S"
              onPress={() => {
                deleteMessage({
                  instanceId: playgroundInstanceId,
                  messageId,
                });
              }}
            />
            <DragHandle
              ref={setActivatorNodeRef}
              listeners={listeners}
              attributes={attributes}
            />
          </Flex>
        }
      >
        <div>
          <MessageEditor
            message={message}
            messageMode={aiMessageMode}
            playgroundInstanceId={playgroundInstanceId}
            templateFormat={templateFormat}
            updateMessage={onMessageUpdate}
          />
        </div>
      </Card>
    </li>
  );
}
