import {
  DefaultChatTransport,
  type HttpChatTransportInitOptions,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

import { EXECUTE_BROWSER_ACTION_TOOL_NAME } from "@phoenix/agent/uiOperations/executeBrowserActionTool";
import type { AgentStore } from "@phoenix/store/agentStore";

/**
 * Marks an `execute_browser_action` call as planned as soon as its tool name
 * streams in, before the script input is complete.
 */
export function createBrowserActionPlanningStream({
  agentStore,
  sessionId,
}: {
  agentStore: AgentStore;
  sessionId: string;
}): TransformStream<UIMessageChunk, UIMessageChunk> {
  return new TransformStream({
    transform(chunk, controller) {
      if (
        chunk.type === "tool-input-start" &&
        chunk.toolName === EXECUTE_BROWSER_ACTION_TOOL_NAME
      ) {
        agentStore
          .getState()
          .markBrowserActionPlanned({
            toolCallId: chunk.toolCallId,
            sessionId,
          });
      }
      controller.enqueue(chunk);
    },
  });
}

export class BrowserActionPlanningTransport<
  UI_MESSAGE extends UIMessage,
> extends DefaultChatTransport<UI_MESSAGE> {
  private readonly planningOptions: {
    agentStore: AgentStore;
    sessionId: string;
  };

  constructor(
    options: HttpChatTransportInitOptions<UI_MESSAGE> & {
      agentStore: AgentStore;
      sessionId: string;
    }
  ) {
    const { agentStore, sessionId, ...transportOptions } = options;
    super(transportOptions);
    this.planningOptions = { agentStore, sessionId };
  }

  protected processResponseStream(
    stream: ReadableStream<Uint8Array>
  ): ReadableStream<UIMessageChunk> {
    return super
      .processResponseStream(stream)
      .pipeThrough(createBrowserActionPlanningStream(this.planningOptions));
  }
}
