import { TextAttributes } from "@opentui/core";
import { getToolName, isToolUIPart } from "ai";

import type { AgentUIMessage } from "../chat/types";
import { markdownSyntaxStyle } from "./markdownStyle";

export type MessageProps = {
  message: AgentUIMessage;
  /** Whether this message is the in-flight assistant reply. */
  streaming: boolean;
};

/**
 * Render a single chat message. User turns are plain prefixed text; assistant
 * turns render their text as markdown and surface any server-side tool activity
 * as dim status lines.
 */
export function Message({ message, streaming }: MessageProps) {
  const text = message.parts.reduce(
    (acc, part) => (part.type === "text" ? acc + part.text : acc),
    ""
  );

  if (message.role === "user") {
    return (
      <box flexDirection="row" marginTop={1}>
        <text fg="#7AA2F7" attributes={TextAttributes.BOLD}>
          {"› "}
        </text>
        <text fg="#C0CAF5">{text}</text>
      </box>
    );
  }

  const toolLines = message.parts
    .filter(isToolUIPart)
    .map((part) => `⚙ ${getToolName(part)} · ${part.state}`);

  return (
    <box flexDirection="column" marginTop={1} width="100%">
      <text fg="#9ECE6A" attributes={TextAttributes.BOLD}>
        PXI
      </text>
      {toolLines.map((line, index) => (
        <text
          key={`tool-${index}`}
          fg="#7A88CF"
          attributes={TextAttributes.DIM}
        >
          {line}
        </text>
      ))}
      {text.length > 0 ? (
        <box width="100%">
          <markdown
            content={text}
            syntaxStyle={markdownSyntaxStyle}
            streaming={streaming}
          />
        </box>
      ) : streaming && toolLines.length === 0 ? (
        <text fg="#565F89" attributes={TextAttributes.DIM}>
          …
        </text>
      ) : null}
    </box>
  );
}
