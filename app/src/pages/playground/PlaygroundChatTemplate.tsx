import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Card, CardProps, TextArea } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";

import { MessageRolePicker } from "./MessageRolePicker";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {}
export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const id = props.playgroundInstanceId;
  // TODO: remove the hard coding of the first instance
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const playground = instances.find((instance) => instance.id === id);
  if (!playground) {
    throw new Error(`Playground instance ${id} not found`);
  }
  const { template } = playground;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  return (
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
          <li key={index}>
            <ChatMessageCard
              role={message.role}
              title={
                <MessageRolePicker
                  includeLabel={false}
                  role={message.role}
                  onChange={(role) => {
                    updateInstance({
                      instanceId: id,
                      patch: {
                        template: {
                          __type: "chat",
                          messages: template.messages.map((message, i) =>
                            i === index ? { ...message, role } : message
                          ),
                        },
                      },
                    });
                  }}
                />
              }
            >
              <TextArea
                height={100}
                value={message.content}
                onChange={(val) => {
                  updateInstance({
                    instanceId: id,
                    patch: {
                      template: {
                        __type: "chat",
                        messages: template.messages.map((message, i) =>
                          i === index ? { ...message, content: val } : message
                        ),
                      },
                    },
                  });
                }}
              />
            </ChatMessageCard>
          </li>
        );
      })}
    </ul>
  );
}

function ChatMessageCard(
  props: PropsWithChildren<{ title: CardProps["title"]; role: string }>
) {
  const styles = useChatMessageStyles(props.role);
  return (
    <Card title={props.title} variant="compact" {...styles}>
      {props.children}
    </Card>
  );
}
