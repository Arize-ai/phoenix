import { TextAttributes } from "@opentui/core";
import { useState } from "react";

import { createServerAgentTransport } from "../chat/transport";
import type { ModelSelection } from "../chat/types";
import { useServerAgentChat } from "../hooks/useServerAgentChat";
import { InputBar } from "./InputBar";
import { StatusLine } from "./StatusLine";
import { Transcript } from "./Transcript";

export type AppProps = {
  /** Fully-resolved server-agent chat URL. */
  chatUrl: string;
  /** Headers applied to every request. */
  headers: Record<string, string>;
  /** Base URL shown in the header. */
  host: string;
  /** Session id for this run. */
  sessionId: string;
  /** Provider + model selection sent with every turn. */
  model: ModelSelection;
  /** Human-readable provider/model label for the header. */
  modelLabel: string;
};

/** Root PXI terminal chat surface: header, transcript, status, and input. */
export function App({
  chatUrl,
  headers,
  host,
  sessionId,
  model,
  modelLabel,
}: AppProps) {
  // Lazy init keeps a single transport instance for the session's lifetime.
  const [transport] = useState(() =>
    createServerAgentTransport({ chatUrl, headers, model })
  );
  const { messages, status, error, send } = useServerAgentChat({
    transport,
    sessionId,
  });
  const [draft, setDraft] = useState("");

  function handleSubmit(value: string) {
    send(value);
    setDraft("");
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box flexDirection="row" justifyContent="space-between">
        <ascii-font font="tiny" text="PXI" />
        <box flexDirection="column" alignItems="flex-end">
          <text fg="#565F89" attributes={TextAttributes.DIM}>
            {host}
          </text>
          <text fg="#565F89" attributes={TextAttributes.DIM}>
            {modelLabel}
          </text>
        </box>
      </box>
      <Transcript messages={messages} status={status} />
      <StatusLine status={status} error={error} sessionId={sessionId} />
      <InputBar
        value={draft}
        onInput={setDraft}
        onSubmit={handleSubmit}
        disabled={status === "streaming"}
      />
    </box>
  );
}
