import type { ChatStatus, ModelMessage } from "ai";
import { streamText } from "ai";
import { useEffect, useRef, useState } from "react";

import {
  downloadBrowserModel,
  getBrowserModelAvailability,
} from "@phoenix/components/generative/browserAI";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { ChatModelSelection } from "./chatModel";
import { createChatModel } from "./chatModel";
import type { ChatParameters } from "./chatParameters";
import { toChatCallSettings } from "./chatParameters";

export type DirectChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** Token totals accumulated across every completed turn of the conversation. */
export type DirectChatUsage = {
  total: number;
  prompt: number;
  completion: number;
};

function toModelMessages(messages: DirectChatMessage[]): ModelMessage[] {
  return messages.map((message) =>
    message.role === "user"
      ? { role: "user" as const, content: message.content }
      : { role: "assistant" as const, content: message.content }
  );
}

/**
 * Extracts a human-readable message from a failed completion. The server
 * proxies provider failures in OpenAI's error envelope
 * (`{"error": {"message": ...}}`), so surface the provider's own words when
 * they're present rather than the SDK's generic status-code message.
 */
function getChatErrorMessage(error: unknown): string {
  // Retried failures arrive wrapped in a RetryError whose message buries the
  // real cause ("Failed after N attempts...") — unwrap to the last
  // underlying error first.
  if (
    error != null &&
    typeof error === "object" &&
    "lastError" in error &&
    error.lastError != null &&
    error.lastError !== error
  ) {
    return getChatErrorMessage(error.lastError);
  }
  if (
    error != null &&
    typeof error === "object" &&
    "responseBody" in error &&
    typeof error.responseBody === "string"
  ) {
    try {
      const parsed: unknown = JSON.parse(error.responseBody);
      if (
        parsed != null &&
        typeof parsed === "object" &&
        "error" in parsed &&
        parsed.error != null &&
        typeof parsed.error === "object" &&
        "message" in parsed.error &&
        typeof parsed.error.message === "string" &&
        parsed.error.message !== ""
      ) {
        return parsed.error.message;
      }
    } catch {
      // Not a JSON body — fall through to the error's own message.
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong while contacting the model.";
}

/**
 * A minimal chat loop over the configured model — Browser AI on-device, or
 * the Phoenix server's OpenAI-compatible `/v1/chat/completions` proxy. The
 * whole conversation lives in memory — nothing is persisted — and each send
 * streams the assistant reply token by token into the last message. The
 * on-device model downloads on first use, reported through
 * `downloadProgress` (a 0–1 fraction, null when no download is running).
 *
 * Statuses mirror the AI SDK's `ChatStatus` so the shared prompt-input
 * components read them natively: `submitted` while waiting for the first
 * token, `streaming` while tokens arrive, then `ready` or `error`.
 */
export function useDirectChat() {
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<DirectChatUsage | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // The conversation dies with this hook — nothing persists it — so an
  // in-flight completion left streaming after the user navigates away would
  // only burn provider tokens into a discarded page. Abort it on unmount.
  useEffect(() => {
    const controllers = abortControllerRef;
    return () => {
      controllers.current?.abort();
    };
  }, []);

  const run = async (
    history: DirectChatMessage[],
    selection: ChatModelSelection,
    parameters: ChatParameters
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages(history);
    setStatus("submitted");
    setError(null);
    // A superseded run skips its ownsChatState()-guarded cleanup, so a stale
    // download fraction from a stopped Browser AI turn is cleared here.
    setDownloadProgress(null);
    /** True while this run still owns the chat state — a newer run or a reset supersedes it. */
    const ownsChatState = () => abortControllerRef.current === controller;
    try {
      if (selection.kind === "browser") {
        const availability = await getBrowserModelAvailability();
        if (availability === "unsupported") {
          throw new Error(
            "This browser has no built-in AI model. Use Chrome or Edge, or choose a hosted model."
          );
        }
        if (availability === "unavailable") {
          throw new Error(
            "The browser's built-in AI model is unavailable on this device. Choose a hosted model instead."
          );
        }
        if (
          availability === "needs-download" ||
          availability === "downloading"
        ) {
          setDownloadProgress(0);
          try {
            await downloadBrowserModel(
              (fraction) => {
                if (ownsChatState()) {
                  setDownloadProgress(fraction);
                }
              },
              { signal: controller.signal }
            );
          } finally {
            if (ownsChatState()) {
              setDownloadProgress(null);
            }
          }
        }
      }
      if (controller.signal.aborted) {
        // Stopped while the model was still downloading — stop() already
        // settled the status.
        return;
      }
      const chatModel = await createChatModel(selection);
      // streamText delivers request/stream failures to onError and ends the
      // text stream quietly — without this capture a failed request would
      // settle as an empty, error-free turn.
      let streamError: unknown = null;
      const result = streamText({
        model: chatModel,
        messages: toModelMessages(history),
        ...toChatCallSettings(parameters),
        abortSignal: controller.signal,
        // One retry keeps transient blips invisible without leaving the user
        // staring at "Thinking..." through the SDK's default three attempts
        // when a provider is genuinely down.
        maxRetries: 1,
        onError: ({ error: caughtError }) => {
          streamError = caughtError;
        },
      });
      const assistantId = generateUUID();
      let hasStartedStreaming = false;
      // Fast providers push hundreds of deltas per second, and each delta
      // arrives in its own microtask so React cannot batch them — flushing
      // at most once per frame keeps the page responsive while looking
      // identical. The final flush below guarantees completeness even when
      // a hidden tab has paused animation frames.
      let accumulated = "";
      let flushHandle: number | null = null;
      const flushContent = () => {
        flushHandle = null;
        const content = accumulated;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId ? { ...message, content } : message
          )
        );
      };
      for await (const delta of result.textStream) {
        if (controller.signal.aborted) {
          break;
        }
        accumulated += delta;
        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          setStatus("streaming");
          setMessages((previous) => [
            ...previous,
            { id: assistantId, role: "assistant", content: accumulated },
          ]);
        } else if (flushHandle === null) {
          flushHandle = requestAnimationFrame(flushContent);
        }
      }
      if (flushHandle !== null) {
        cancelAnimationFrame(flushHandle);
        flushContent();
      }
      if (streamError != null) {
        throw streamError;
      }
      // Browser AI is excluded: the Prompt API reports no real token counts,
      // so the adapter's synthesized numbers (notably completion tokens on
      // Gemini Nano) are estimates that can be badly wrong. Only accumulate
      // usage the provider actually measured.
      if (!controller.signal.aborted && selection.kind !== "browser") {
        // The stream ended normally, so the usage promise has settled. Not
        // every provider reports usage — skip the turn when it doesn't.
        try {
          const turnUsage = await result.totalUsage;
          const prompt = turnUsage.inputTokens ?? 0;
          const completion = turnUsage.outputTokens ?? 0;
          const total = turnUsage.totalTokens ?? prompt + completion;
          if (total > 0 && ownsChatState()) {
            setUsage((previous) => ({
              total: (previous?.total ?? 0) + total,
              prompt: (previous?.prompt ?? 0) + prompt,
              completion: (previous?.completion ?? 0) + completion,
            }));
          }
        } catch {
          // Usage unavailable for this turn — the running totals stand.
        }
      }
      if (ownsChatState()) {
        setStatus("ready");
      }
    } catch (streamError) {
      if (!ownsChatState()) {
        return;
      }
      if (controller.signal.aborted) {
        // Stopped by the user — keep whatever streamed in and settle.
        setStatus("ready");
        return;
      }
      setError(getChatErrorMessage(streamError));
      setStatus("error");
    } finally {
      if (ownsChatState()) {
        abortControllerRef.current = null;
      }
    }
  };

  const isBusy = status === "submitted" || status === "streaming";

  /** Sends a user message and streams the assistant reply. */
  const sendMessage = (
    text: string,
    selection: ChatModelSelection,
    parameters: ChatParameters
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) {
      return;
    }
    void run(
      [...messages, { id: generateUUID(), role: "user", content: trimmed }],
      selection,
      parameters
    );
  };

  /** Re-sends the conversation from the latest user message after an error. */
  const retry = (selection: ChatModelSelection, parameters: ChatParameters) => {
    if (isBusy) {
      return;
    }
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user"
    );
    if (lastUserIndex === -1) {
      return;
    }
    void run(messages.slice(0, lastUserIndex + 1), selection, parameters);
  };

  /** Aborts the in-flight completion, keeping any partial response. */
  const stop = () => {
    const controller = abortControllerRef.current;
    if (!controller) {
      return;
    }
    controller.abort();
    // Settle immediately instead of waiting for the aborted stream to unwind:
    // when the abort lands before the first chunk, the SDK's text stream can
    // hang on its first read and would leave the UI stuck on "submitted".
    // The run's own state writes are guarded, so a late unwind is a no-op.
    setStatus("ready");
  };

  /** Discards the conversation and settles back to an empty, ready chat. */
  const clear = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setStatus("ready");
    setError(null);
    setUsage(null);
    setDownloadProgress(null);
  };

  return {
    messages,
    status,
    error,
    usage,
    downloadProgress,
    sendMessage,
    retry,
    stop,
    clear,
  };
}
