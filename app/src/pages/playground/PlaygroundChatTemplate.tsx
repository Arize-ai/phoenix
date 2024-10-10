import React, { PropsWithChildren } from "react";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  Flex,
  Icon,
  Icons,
  TextArea,
  View,
} from "@arizeai/components";

import { DragHandle } from "@phoenix/components/dnd/DragHandle";
import { move } from "@phoenix/components/dnd/helpers/move";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundChatTemplate as PlaygroundChatTemplateType,
} from "@phoenix/store";

import { chatTemplateDndSensors } from "./chatTemplateDndSensors";
import { MessageRolePicker } from "./MessageRolePicker";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {}
export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const id = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const playgroundInstance = instances.find((instance) => instance.id === id);
  if (!playgroundInstance) {
    throw new Error(`Playground instance ${id} not found`);
  }
  const { template } = playgroundInstance;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  return (
    <DragDropProvider
      sensors={chatTemplateDndSensors}
      onDragOver={(event) => {
        const newMessages = move(template.messages, event);
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
      onDragEnd={(event) => {
        const newMessages = move(template.messages, event);
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
              template={template}
              key={message.id}
              message={message}
              index={index}
            />
          );
        })}
      </ul>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="dark"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            variant="default"
            aria-label="add message"
            size="compact"
            icon={<Icon svg={<Icons.PlusOutline />} />}
            onClick={() => {
              updateInstance({
                instanceId: id,
                patch: {
                  template: {
                    __type: "chat",
                    messages: [
                      ...template.messages,
                      {
                        id: generateMessageId(),
                        role: "user",
                        content: "",
                      },
                    ],
                  },
                },
              });
            }}
          >
            Message
          </Button>
        </Flex>
      </View>
    </DragDropProvider>
  );
}

function SortableMessageItem({
  playgroundInstanceId,
  template,
  message,
  index,
}: PropsWithChildren<
  PlaygroundInstanceProps & {
    template: PlaygroundChatTemplateType;
    message: ChatMessage;
    index: number;
  }
>) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const { ref, handleRef } = useSortable({
    id: message.id,
    index,
    // @ts-expect-error experimental dnd
    modifiers: [RestrictToVerticalAxis],
  });
  const styles = useChatMessageStyles(message.role);
  return (
    <li ref={ref}>
      <Card
        variant="compact"
        bodyStyle={{ padding: 0 }}
        {...styles}
        title={
          <MessageRolePicker
            includeLabel={false}
            role={message.role}
            onChange={(role) => {
              updateInstance({
                instanceId: playgroundInstanceId,
                patch: {
                  template: {
                    __type: "chat",
                    messages: template.messages.map((msg) =>
                      msg.id === message.id ? { ...msg, role } : msg
                    ),
                  },
                },
              });
            }}
          />
        }
        extra={
          <Flex direction="row" gap="size-100">
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
            <DragHandle ref={handleRef} />
          </Flex>
        }
      >
        <div
          css={css`
            // TODO: remove these styles once the codemiror editor is added
            .ac-textfield {
              border: none !important;
              border-radius: 0;
              textarea {
                padding: var(--ac-global-dimension-size-200);
              }
            }
          `}
          onKeyDownCapture={(e) => {
            // Don't bubble up any keyboard events from the text area as to not interfere with DND
            e.stopPropagation();
          }}
        >
          <TextArea
            value={message.content}
            height={200}
            variant="quiet"
            onChange={(val) => {
              updateInstance({
                instanceId: playgroundInstanceId,
                patch: {
                  template: {
                    __type: "chat",
                    messages: template.messages.map((msg) =>
                      msg.id === message.id ? { ...msg, content: val } : msg
                    ),
                  },
                },
              });
            }}
          />
        </div>
      </Card>
    </li>
  );
}
