import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import { AssistantMessageActions } from "../AssistantMessageActions";

installTestStorage();

vi.mock("@phoenix/api/authApiFetch", () => ({
  authApiFetch: {
    POST: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("@phoenix/contexts/ViewerContext", () => ({
  useViewer: () => ({
    viewer: { username: "alice", id: "user-1" },
    refetchViewer: () => undefined,
  }),
}));

const apiPost = authApiFetch.POST as unknown as Mock;
const apiDelete = authApiFetch.DELETE as unknown as Mock;

function okResponse() {
  return { response: { ok: true } };
}

const assistantMessage = {
  id: "assistant-message",
  role: "assistant",
  parts: [{ type: "text", text: "Here is the answer." }],
  metadata: {
    phoenix: {
      type: "assistant",
      sessionId: "session-1",
      turnTraceContext: {
        traceId: "trace-1",
        rootSpanId: "span-1",
        startedAt: "2026-07-22T12:00:00.000Z",
      },
    },
  },
} as AgentUIMessage;

describe("AssistantMessageActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    apiPost.mockReset();
    apiDelete.mockReset();
    apiPost.mockResolvedValue(okResponse());
    apiDelete.mockResolvedValue(okResponse());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderActions() {
    const store = createAgentStore({});
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <AgentContext.Provider value={store}>
            <AssistantMessageActions message={assistantMessage} />
          </AgentContext.Provider>
        </ThemeProvider>
      );
    });
  }

  it("writes user_feedback only on the turn trace, not the root span", async () => {
    renderActions();
    const thumbsUp = container.querySelector<HTMLButtonElement>(
      '[aria-label="Thumbs up"]'
    );
    expect(thumbsUp).not.toBeNull();

    await act(async () => {
      await userEvent.setup().click(thumbsUp!);
    });

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledTimes(1);
    });
    expect(apiPost).toHaveBeenCalledWith(
      "/v1/trace_annotations",
      expect.objectContaining({
        params: { query: { sync: true } },
        body: {
          data: [
            expect.objectContaining({
              annotator_kind: "HUMAN",
              identifier: "alice:assistant-message",
              name: "user_feedback",
              trace_id: "trace-1",
              result: { label: "positive", score: 1 },
            }),
          ],
        },
      })
    );
    expect(apiPost.mock.calls.map((call) => call[0])).not.toContain(
      "/v1/span_annotations"
    );
  });
});
