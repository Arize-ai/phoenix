import React from "react";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import { MustacheEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstanceProps } from "./types";

const messagesListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
`;

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {}
export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const messages = usePlaygroundContext((state) => {
    const instance = state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    );
    if (!instance) {
      throw new Error(
        `Playground instance ${props.playgroundInstanceId} not found`
      );
    }
    if (instance.template.__type !== "chat") {
      throw new Error(
        `Playground instance ${props.playgroundInstanceId} is not a chat template`
      );
    }
    return instance?.template.messages;
  });
  return (
    <ul css={messagesListCSS}>
      {messages.map((message, index) => (
        <li key={index}>
          <ChatMessage role={message.role} content={message.content} />
        </li>
      ))}
    </ul>
  );
}

function ChatMessage(props: { role: string; content: string }) {
  return (
    <Card variant="compact" title={props.role} bodyStyle={{ padding: 0 }}>
      <MustacheEditor value={props.content} />
    </Card>
  );
}
