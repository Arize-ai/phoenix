import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  Alert,
  Button,
  Card,
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
import { DragHandle } from "@phoenix/components/dnd/DragHandle";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { validateMustacheSections } from "@phoenix/components/templateEditor/language/mustacheLike";
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
import { areInvocationParamsEqual } from "./invocationParameterUtils";
import {
  AIMessageContentRadioGroup,
  AIMessageMode,
  MessageMode,
} from "./MessageContentRadioGroup";
import { MessageRoleSelect } from "./MessageRoleSelect";
import { PlaygroundChatTemplateFooter } from "./PlaygroundChatTemplateFooter";
import { PlaygroundResponseFormat } from "./PlaygroundResponseFormat";
import { PlaygroundTools } from "./PlaygroundTools";
import { createToolCallForProvider } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

/**
 * The z-index of the dragging message.
 * Only applied when actively dragging to ensure the dragged message appears above others.
 * Non-dragging messages should NOT have a z-index to avoid creating stacking contexts
 * that would clip autocomplete dropdowns.
 */
const DRAGGING_MESSAGE_Z_INDEX = 10;

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {
  appendedMessagesPath?: string | null;
}

export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const id = props.playgroundInstanceId;

  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const appendedMessagesPath = props.appendedMessagesPath;
  const instanceSelector = useMemo(() => selectPlaygroundInstance(id), [id]);
  const playgroundInstance = usePlaygroundContext(instanceSelector);
  if (!playgroundInstance) {
    throw new Error(`Playground instance ${id} not found`);
  }

  const hasTools = !props.disableTools && playgroundInstance.tools.length > 0;
  const hasResponseFormat =
    !props.disableResponseFormat &&
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

  const { disableResponseFormat, disableNewTool } = props;

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
            gap: var(--ac-global-dimension-size-100);
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
      {appendedMessagesPath ? (
        <View paddingTop="size-100" paddingBottom="size-100">
          <Alert variant="info">
            Messages from the configured path{" "}
            <strong>{appendedMessagesPath}</strong> will be appended to this
            prompt.
          </Alert>
        </View>
      ) : null}
      <View paddingTop="size-100" paddingBottom="size-100">
        <PlaygroundChatTemplateFooter
          instanceId={id}
          hasResponseFormat={hasResponseFormat}
          disableResponseFormat={disableResponseFormat}
          disableNewTool={disableNewTool}
        />
      </View>
      {hasTools || hasResponseFormat ? (
        <Flex direction="column" gap="size-100">
          {hasTools ? <PlaygroundTools {...props} /> : null}
          {hasResponseFormat ? <PlaygroundResponseFormat {...props} /> : null}
        </Flex>
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
  const hasValidationIssues =
    sectionValidation != null &&
    (sectionValidation?.errors.length > 0 ||
      sectionValidation?.warnings.length > 0);
  // Reset validation state when switching to a different message or template format
  useEffect(() => {
    if (!hasValidationIssues) {
      setShowValidation(false);
    }
  }, [message.id, templateFormat, hasValidationIssues]);
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
          <CodeWrap width={"100%"}>
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
  // Get available paths for autocomplete from the dataset state
  const availablePaths = usePlaygroundContext((state) => {
    const datasetId = state.datasetId;
    if (!datasetId) return undefined;
    return state.stateByDatasetId[datasetId]?.availablePaths;
  });
  const messageCardStyles = useChatMessageStyles(message.role);
  const dragAndDropLiStyles = {
    transform: CSS.Translate.toString(transform),
    transition,
    // Only set z-index when dragging to avoid creating stacking contexts
    // that would clip autocomplete dropdowns
    zIndex: isDragging ? DRAGGING_MESSAGE_Z_INDEX : undefined,
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
            availablePaths={availablePaths}
          />
        </div>
      </Card>
    </li>
  );
}
