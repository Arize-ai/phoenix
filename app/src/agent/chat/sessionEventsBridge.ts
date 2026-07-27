import type { Chat } from "@ai-sdk/react";
import {
  parseJsonEventStream,
  uiMessageChunkSchema,
  type UIMessageChunk,
} from "ai";

import type { TranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type { components } from "@phoenix/api/__generated__/v1";
import { authFetch } from "@phoenix/authFetch";
import type {
  AgentStore,
  SessionBusConnection,
  SessionBusState,
} from "@phoenix/store/agentStore";

type SessionStateData = components["schemas"]["SessionStateData"];
type SessionTurnStartedData = components["schemas"]["SessionTurnStartedData"];

type TurnWindow = {
  turnId: string;
  stream: ReadableStream<UIMessageChunk>;
  controller: ReadableStreamDefaultController<UIMessageChunk>;
  isClaimed: boolean;
  isSuperseded: boolean;
};

type SessionEventsBridgeBinding = {
  chat: Chat<AgentUIMessage>;
  transcriptPersistence: TranscriptPersistenceCoordinator;
  refetchTranscript: () => Promise<void>;
};

const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8_000;
const DEGRADED_REFETCH_INTERVAL_MS = 4_000;

/**
 * Owns the authenticated session event subscription and exposes one replay
 * window at a time to the AI SDK's reconnect transport.
 */
export class SessionEventsBridge {
  private readonly sessionId: string;
  private readonly eventsApiUrl: string;
  private readonly clientId: string;
  private readonly agentStore: AgentStore;
  private abortController: AbortController | null = null;
  private binding: SessionEventsBridgeBinding | null = null;
  private currentTurnWindow: TurnWindow | null = null;
  private currentTurnStarted: SessionTurnStartedData | null = null;
  private currentSessionState: SessionStateData | null = null;
  private localPostCount = 0;
  private hasOriginatedActiveTurn = false;
  private resumeQueue: Promise<void> = Promise.resolve();
  private degradedRefetchTimer: ReturnType<typeof setInterval> | null = null;

  constructor({
    sessionId,
    eventsApiUrl,
    clientId,
    agentStore,
  }: {
    sessionId: string;
    eventsApiUrl: string;
    clientId: string;
    agentStore: AgentStore;
  }) {
    this.sessionId = sessionId;
    this.eventsApiUrl = eventsApiUrl;
    this.clientId = clientId;
    this.agentStore = agentStore;
  }

  bind(binding: SessionEventsBridgeBinding): void {
    this.binding = binding;
  }

  start(): void {
    if (this.abortController != null) {
      return;
    }
    const abortController = new AbortController();
    this.abortController = abortController;
    this.setConnection("connecting");
    void this.runConnectionLoop(abortController.signal);
  }

  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.stopDegradedRefetch();
    this.failCurrentTurn(
      new DOMException("Session event bridge closed", "AbortError")
    );
    this.binding = null;
    this.agentStore.getState().setSessionResponsePending(this.sessionId, false);
    this.agentStore.getState().clearSessionBusState(this.sessionId);
  }

  /** Marks a POST response as authoritative so its duplicate bus replay is ignored. */
  beginLocalPost(): (shouldResume?: boolean) => void {
    this.localPostCount += 1;
    this.hasOriginatedActiveTurn = true;
    let hasEnded = false;
    return (shouldResume = false) => {
      if (hasEnded) {
        return;
      }
      hasEnded = true;
      this.localPostCount = Math.max(0, this.localPostCount - 1);
      if (
        shouldResume &&
        this.localPostCount === 0 &&
        this.currentTurnStarted != null
      ) {
        this.openReplayWindow(this.currentTurnStarted);
      }
    };
  }

  /** Whether this resident runtime owns client-tool execution for the active turn. */
  canExecuteClientTools(): boolean {
    return (
      this.localPostCount > 0 ||
      this.hasOriginatedActiveTurn ||
      this.currentSessionState?.originClientId === this.clientId
    );
  }

  getReconnectStream(): ReadableStream<UIMessageChunk> | null {
    if (this.localPostCount > 0) {
      return null;
    }
    const turnWindow = this.currentTurnWindow;
    if (turnWindow == null || turnWindow.isClaimed || turnWindow.isSuperseded) {
      return null;
    }
    turnWindow.isClaimed = true;
    return turnWindow.stream;
  }

  private async runConnectionLoop(signal: AbortSignal): Promise<void> {
    let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    while (!signal.aborted) {
      try {
        const response = await authFetch(this.eventsApiUrl, {
          headers: { Accept: "text/event-stream" },
          signal,
        });
        if (!response.ok) {
          throw new Error(
            `Session events failed with status ${response.status}`
          );
        }
        if (response.body == null) {
          throw new Error("Session events response body is empty");
        }
        reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
        this.setConnection("connected");
        await this.consumeEventStream(response.body, signal);
        if (!signal.aborted) {
          throw new Error("Session events stream ended unexpectedly");
        }
      } catch (error) {
        if (signal.aborted) {
          break;
        }
        this.failCurrentTurn(
          error instanceof Error
            ? error
            : new Error("Session events connection failed")
        );
        this.setConnection("reconnecting");
        await waitForDelay({ delayMs: reconnectDelayMs, signal });
        reconnectDelayMs = Math.min(
          reconnectDelayMs * 2,
          MAX_RECONNECT_DELAY_MS
        );
      }
    }
    if (this.abortController?.signal === signal) {
      this.setConnection("disconnected");
    }
  }

  private async consumeEventStream(
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
    signal: AbortSignal
  ): Promise<void> {
    const reader = parseJsonEventStream({
      stream,
      schema: uiMessageChunkSchema,
    }).getReader();
    const abortReader = () => {
      void reader.cancel(signal.reason);
    };
    signal.addEventListener("abort", abortReader, { once: true });
    try {
      while (!signal.aborted) {
        const result = await reader.read();
        if (result.done) {
          return;
        }
        if (!result.value.success) {
          throw result.value.error;
        }
        this.handleChunk(result.value.value);
      }
    } finally {
      signal.removeEventListener("abort", abortReader);
      reader.releaseLock();
    }
  }

  private handleChunk(chunk: UIMessageChunk): void {
    if (chunk.type === "data-session-state" && isSessionStateData(chunk.data)) {
      this.handleSessionState(chunk.data);
      return;
    }
    if (
      chunk.type === "data-turn-started" &&
      isSessionTurnStartedData(chunk.data)
    ) {
      this.handleTurnStarted(chunk.data);
      return;
    }
    if (
      chunk.type === "data-transcript-persisted" &&
      isTranscriptPersistedData(chunk.data)
    ) {
      if (this.currentTurnWindow != null) {
        this.binding?.transcriptPersistence.acknowledge(chunk.data);
      }
      return;
    }
    this.currentTurnWindow?.controller.enqueue(chunk);
  }

  private handleSessionState(data: SessionStateData): void {
    const previousState = this.currentSessionState;
    this.currentSessionState = data;
    const degraded = !data.ownedByThisInstance || !data.streamAvailable;
    const connection =
      this.agentStore.getState().sessionBusStateBySessionId[this.sessionId]
        ?.connection ?? "connected";
    this.agentStore.getState().setSessionBusState(this.sessionId, {
      state: data.state,
      turnId: data.turnId ?? null,
      assistantMessageId: data.assistantMessageId ?? null,
      originClientId: data.originClientId ?? null,
      degraded,
      connection,
    });

    this.hasOriginatedActiveTurn =
      data.state !== "idle" && data.originClientId === this.clientId;

    const hasTurnEnded =
      data.state === "idle" || data.state === "awaiting_client_tool";
    if (hasTurnEnded) {
      this.closeCurrentTurn();
    }

    const shouldPollTranscript = degraded && data.state !== "idle";
    if (shouldPollTranscript) {
      this.startDegradedRefetch();
    } else {
      this.stopDegradedRefetch();
    }

    if (data.state === "idle") {
      this.currentTurnStarted = null;
      this.agentStore
        .getState()
        .setSessionResponsePending(this.sessionId, false);
      if (
        previousState?.state !== "idle" ||
        previousState?.streamAvailable === false
      ) {
        void this.refetchTranscript();
      }
    }
  }

  private handleTurnStarted(data: SessionTurnStartedData): void {
    this.currentTurnStarted = data;
    this.openReplayWindow(data);
  }

  private openReplayWindow(data: SessionTurnStartedData): void {
    const sessionState = this.currentSessionState;
    const isLocalPostActive = this.localPostCount > 0;
    const isStreamAvailable = sessionState?.streamAvailable !== false;
    const isTurnInFlight =
      sessionState?.state === "streaming" ||
      sessionState?.state === "persisting";
    if (isLocalPostActive || !isStreamAvailable || !isTurnInFlight) {
      return;
    }

    this.agentStore.getState().setSessionResponsePending(this.sessionId, true);
    this.supersedeCurrentTurn();
    let controller: ReadableStreamDefaultController<UIMessageChunk>;
    const stream = new ReadableStream<UIMessageChunk>({
      start(streamController) {
        controller = streamController;
      },
    });
    const turnWindow: TurnWindow = {
      turnId: data.turnId,
      stream,
      controller: controller!,
      isClaimed: false,
      isSuperseded: false,
    };
    this.currentTurnWindow = turnWindow;
    const submittedMessage = data.message as unknown as AgentUIMessage;
    this.resumeQueue = this.resumeQueue
      .catch(() => undefined)
      .then(async () => {
        if (turnWindow.isSuperseded || this.binding == null) {
          return;
        }
        restoreSubmittedMessageBaseline({
          chat: this.binding.chat,
          submittedMessage,
        });
        await this.binding.chat.resumeStream();
      });
  }

  private closeCurrentTurn(): void {
    const turnWindow = this.currentTurnWindow;
    if (turnWindow == null || turnWindow.isSuperseded) {
      return;
    }
    turnWindow.controller.close();
    this.currentTurnWindow = null;
  }

  private supersedeCurrentTurn(): void {
    const turnWindow = this.currentTurnWindow;
    if (turnWindow == null) {
      return;
    }
    turnWindow.isSuperseded = true;
    turnWindow.controller.error(
      new TypeError(`Replaying session turn ${turnWindow.turnId}`)
    );
    this.currentTurnWindow = null;
  }

  private failCurrentTurn(error: Error): void {
    const turnWindow = this.currentTurnWindow;
    if (turnWindow == null) {
      return;
    }
    turnWindow.isSuperseded = true;
    turnWindow.controller.error(error);
    this.currentTurnWindow = null;
  }

  private setConnection(connection: SessionBusConnection): void {
    const current =
      this.agentStore.getState().sessionBusStateBySessionId[this.sessionId];
    const next: SessionBusState = {
      state: current?.state ?? "idle",
      turnId: current?.turnId ?? null,
      assistantMessageId: current?.assistantMessageId ?? null,
      originClientId: current?.originClientId ?? null,
      degraded: current?.degraded ?? false,
      connection,
    };
    this.agentStore.getState().setSessionBusState(this.sessionId, next);
  }

  private startDegradedRefetch(): void {
    if (this.degradedRefetchTimer != null) {
      return;
    }
    void this.refetchTranscript();
    this.degradedRefetchTimer = setInterval(() => {
      void this.refetchTranscript();
    }, DEGRADED_REFETCH_INTERVAL_MS);
  }

  private stopDegradedRefetch(): void {
    if (this.degradedRefetchTimer == null) {
      return;
    }
    clearInterval(this.degradedRefetchTimer);
    this.degradedRefetchTimer = null;
  }

  private async refetchTranscript(): Promise<void> {
    try {
      await this.binding?.refetchTranscript();
    } catch {
      // The event connection remains authoritative and the next poll retries.
    }
  }
}

/** Restore the server-submitted baseline before consuming a full turn replay. */
function restoreSubmittedMessageBaseline({
  chat,
  submittedMessage,
}: {
  chat: Chat<AgentUIMessage>;
  submittedMessage: AgentUIMessage;
}): void {
  const messages = chat.messages;
  const submittedMessageIndex = messages.findIndex(
    (message) => message.id === submittedMessage.id
  );
  if (submittedMessageIndex >= 0) {
    chat.messages = [
      ...messages.slice(0, submittedMessageIndex),
      submittedMessage,
    ];
    return;
  }

  const hasTrailingPartialAssistant = messages.at(-1)?.role === "assistant";
  const baseline = hasTrailingPartialAssistant
    ? messages.slice(0, -1)
    : messages;
  chat.messages = [...baseline, submittedMessage];
}

function isSessionStateData(value: unknown): value is SessionStateData {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isSessionRunState(value.state) &&
    typeof value.ownedByThisInstance === "boolean" &&
    typeof value.streamAvailable === "boolean"
  );
}

function isSessionTurnStartedData(
  value: unknown
): value is SessionTurnStartedData {
  return (
    isRecord(value) &&
    typeof value.turnId === "string" &&
    isRecord(value.message) &&
    typeof value.message.id === "string" &&
    Array.isArray(value.message.parts)
  );
}

function isTranscriptPersistedData(
  value: unknown
): value is components["schemas"]["TranscriptPersistedData"] {
  return isRecord(value) && typeof value.messageId === "string";
}

function isSessionRunState(
  value: unknown
): value is components["schemas"]["SessionRunState"] {
  return (
    value === "idle" ||
    value === "streaming" ||
    value === "persisting" ||
    value === "awaiting_client_tool" ||
    value === "mutating"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function waitForDelay({
  delayMs,
  signal,
}: {
  delayMs: number;
  signal: AbortSignal;
}): Promise<void> {
  if (signal.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
