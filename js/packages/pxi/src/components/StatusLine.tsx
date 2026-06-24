import { TextAttributes } from "@opentui/core";

import type { ChatStatus } from "../hooks/useServerAgentChat";

export type StatusLineProps = {
  status: ChatStatus;
  error: string | null;
  sessionId: string;
};

/** Single-line footer reflecting connection/streaming state. */
export function StatusLine({ status, error, sessionId }: StatusLineProps) {
  if (status === "streaming") {
    return (
      <text fg="#E0AF68" attributes={TextAttributes.DIM}>
        ● PXI is thinking…
      </text>
    );
  }
  if (status === "error") {
    return <text fg="#F7768E">✖ {error ?? "Request failed"}</text>;
  }
  return (
    <text fg="#565F89" attributes={TextAttributes.DIM}>
      Ctrl+C to exit · session {sessionId.slice(0, 8)}
    </text>
  );
}
