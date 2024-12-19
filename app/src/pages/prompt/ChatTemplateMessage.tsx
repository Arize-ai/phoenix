import React from "react";

import { Card } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";

export type ChatTemplateMessageProps = {
  role: string;
  content: string;
  templateFormat: TemplateLanguage;
};

/**
 * A Read-Only CodeMirror component for the chat template message
 * E.x. a system or user message template part
 */
export function ChatTemplateMessage(props: ChatTemplateMessageProps) {
  const { role, content, templateFormat } = props;
  const styles = useChatMessageStyles(role);
  return (
    <Card
      title={role}
      variant="compact"
      {...styles}
      bodyStyle={{ padding: 0 }}
      extra={<CopyToClipboardButton text={content} />}
    >
      <TemplateEditorWrap>
        <TemplateEditor
          readOnly
          height="100%"
          value={content}
          templateLanguage={templateFormat}
        />
      </TemplateEditorWrap>
    </Card>
  );
}
