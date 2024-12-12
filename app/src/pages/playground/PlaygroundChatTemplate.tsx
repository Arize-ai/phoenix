import React, { PropsWithChildren, useCallback, useState } from "react";
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

import {
  Button,
  Card,
  Field,
  Flex,
  Form,
  Icon,
  Icons,
  TextField,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { DragHandle } from "@phoenix/components/dnd/DragHandle";
import { TemplateEditor } from "@phoenix/components/templateEditor";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  ChatMessage,
  PlaygroundChatTemplate as PlaygroundChatTemplateType,
  PlaygroundInstance,
} from "@phoenix/store";
import { convertMessageToolCallsToProvider } from "@phoenix/store/playground/playgroundStoreUtils";
import { assertUnreachable } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

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
  normalizeMessageAttributeValue,
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

  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const playgroundInstance = instances.find((instance) => instance.id === id);
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
        const activeIndex = template.messages.findIndex(
          (message) => message.id === active.id
        );
        const overIndex = template.messages.findIndex(
          (message) => message.id === over.id
        );
        const newMessages = arrayMove(
          template.messages,
          activeIndex,
          overIndex
        );
        updateInstance({
          instanceId: id,
          patch: {
            template: {
              __type: "chat",
              messages: newMessages,
            },
          },
        });
      }}
    >
      <SortableContext items={template.messages}>
        <ul
          css={css`
            display: flex;
            flex-direction: column;
            gap: var(--ac-global-dimension-size-200);
            padding: var(--ac-global-dimension-size-200);
          `}
        >
          {template.messages.map((message, index) => {
            return (
              <SortableMessageItem
                playgroundInstanceId={id}
                instance={playgroundInstance}
                templateLanguage={templateLanguage}
                template={template}
                key={message.id}
                message={message}
                index={index}
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
      {hasTools ? <PlaygroundTools {...props} /> : null}
      {hasResponseFormat ? <PlaygroundResponseFormat {...props} /> : null}
    </DndContext>
  );
}

function MessageEditor({
  message,
  updateMessage,
  templateLanguage,
  playgroundInstanceId,
  template,
  messageMode,
}: {
  playgroundInstanceId: number;
  message: ChatMessage;
  template: PlaygroundChatTemplateType;
  templateLanguage: TemplateLanguage;
  updateMessage: (patch: Partial<ChatMessage>) => void;
  messageMode: MessageMode;
}) {
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
              toolCalls={message.toolCalls}
              templateMessages={template.messages}
              messageId={message.id}
            />
          </CodeWrap>
        </Field>
      </View>
    );
  }
  if (message.role === "tool") {
    const toolMessageContent = normalizeMessageAttributeValue(message.content);
    return (
      <Form
        onSubmit={(e) => {
          // Block default form submission to prevent page from refreshing
          e.preventDefault();
        }}
      >
        <View
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-200"
          paddingBottom="size-200"
          borderColor="yellow-700"
          borderBottomWidth="thin"
        >
          <TextField
            value={message.toolCallId}
            onChange={(val) => updateMessage({ toolCallId: val })}
            aria-label="Tool Call ID"
            addonBefore="Tool Call ID"
          />
        </View>
        <JSONEditor
          value={toolMessageContent}
          aria-label="tool message content"
          height={"100%"}
          onChange={(val) => updateMessage({ content: val })}
          onBlur={() => {
            if (message.content == null) {
              return;
            }
            if (typeof message.content === "string") {
              const { json: parsedContent } = safelyParseJSON(message.content);
              updateMessage({
                content: JSON.stringify(parsedContent, null, 2),
              });
            }
          }}
        />
      </Form>
    );
  }
  return (
    <div
      css={css`
        & .cm-content {
          padding-left: var(--ac-global-dimension-size-250);
          padding-right: var(--ac-global-dimension-size-250);
        }
        & .cm-gutter,
        & .cm-content {
          min-height: 75px;
        }
        & .cm-line {
          padding-left: 0;
          padding-right: 0;
        }
      `}
    >
      <TemplateEditor
        height="100%"
        value={
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content, null, 2)
        }
        aria-label="Message content"
        templateLanguage={templateLanguage}
        onChange={(val) => updateMessage({ content: val })}
        placeholder={
          message.role === "system"
            ? "You are a helpful assistant"
            : message.role === "ai"
              ? "Hello, how can I help you today?"
              : "What is the weather in San Francisco?"
        }
      />
    </div>
  );
}

function SortableMessageItem({
  playgroundInstanceId,
  templateLanguage,
  template,
  message,
  instance,
}: PropsWithChildren<
  PlaygroundInstanceProps & {
    template: PlaygroundChatTemplateType;
    message: ChatMessage;
    templateLanguage: TemplateLanguage;
    index: number;
    instance: PlaygroundInstance;
  }
>) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({
    id: message.id,
  });

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

  const updateMessage = useCallback(
    (patch: Partial<ChatMessage>) => {
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          template: {
            __type: "chat",
            messages: template.messages.map((msg) =>
              msg.id === message.id ? { ...msg, ...patch } : msg
            ),
          },
        },
      });
    },
    [message.id, playgroundInstanceId, template.messages, updateInstance]
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

  return (
    <li ref={setNodeRef} style={dragAndDropLiStyles}>
      <Card
        collapsible
        variant="compact"
        bodyStyle={{ padding: 0 }}
        {...messageCardStyles}
        title={
          <MessageRolePicker
            includeLabel={false}
            role={message.role}
            onChange={(role) => {
              let toolCalls = message.toolCalls;
              // Tool calls should only be attached to ai messages
              // Clear tools from the message and reset the message mode when switching away form ai
              if (role !== "ai") {
                toolCalls = undefined;
                setAIMessageMode("text");
              }
              updateInstance({
                instanceId: playgroundInstanceId,
                patch: {
                  template: {
                    __type: "chat",
                    messages: template.messages.map((msg) =>
                      msg.id === message.id ? { ...msg, role, toolCalls } : msg
                    ),
                  },
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
                          content: previousMessageContent,
                          toolCalls: undefined,
                        });
                        break;
                      case "toolCalls":
                        setPreviousMessageContent(message.content);
                        updateMessage({
                          content: "",
                          toolCalls:
                            previousMessageToolCalls != null
                              ? convertMessageToolCallsToProvider({
                                  toolCalls: previousMessageToolCalls,
                                  provider: instance.model.provider,
                                })
                              : [
                                  createToolCallForProvider(
                                    instance.model.provider
                                  ),
                                ],
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
                  ? JSON.stringify(message.toolCalls)
                  : normalizeMessageAttributeValue(message.content)
              }
            />
            <Button
              aria-label="Delete message"
              icon={<Icon svg={<Icons.TrashOutline />} />}
              variant="default"
              size="compact"
              onClick={() => {
                updateInstance({
                  instanceId: playgroundInstanceId,
                  patch: {
                    template: {
                      __type: "chat",
                      messages: template.messages.filter(
                        (msg) => msg.id !== message.id
                      ),
                    },
                  },
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
            template={template}
            templateLanguage={templateLanguage}
            updateMessage={updateMessage}
          />
        </div>
      </Card>
    </li>
  );
}
