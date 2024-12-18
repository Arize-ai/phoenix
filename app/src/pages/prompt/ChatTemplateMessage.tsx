import React from "react";

import { Button, Card, Icon, Icons } from "@arizeai/components";

import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";

export type ChatTemplateMessageProps = {
  role: string;
  content: string;
};

/**
 * A Read-Only CodeMirror component for the chat template message
 * E.x. a system or user message template part
 */
export function ChatTemplateMessage(props: ChatTemplateMessageProps) {
  const { role, content } = props;
  const styles = useChatMessageStyles(role);
  return (
    <Card
      title={role}
      variant="compact"
      {...styles}
      extra={
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.ClipboardCopy />} />}
        />
      }
    >
      {content}
    </Card>
  );
}
