import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import { createAgentStore } from "@phoenix/store/agentStore";

import {
  parseSetSessionsFilterInput,
  setSessionsFilterAgentTool,
  SET_SESSIONS_FILTER_TOOL_NAME,
} from "../index";

installTestStorage();

describe("sessions filter agent tool", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
  });

  it("parses string conditions, including the empty clear-filter condition", () => {
    expect(
      parseSetSessionsFilterInput({ condition: "score > 0", extra: true })
    ).toEqual({
      condition: "score > 0",
    });
    expect(parseSetSessionsFilterInput({ condition: "" })).toEqual({
      condition: "",
    });
  });

  it("rejects payloads without a string condition", () => {
    expect(parseSetSessionsFilterInput(null)).toBeNull();
    expect(parseSetSessionsFilterInput("score > 0")).toBeNull();
    expect(parseSetSessionsFilterInput({})).toBeNull();
    expect(parseSetSessionsFilterInput({ condition: 42 })).toBeNull();
    expect(parseSetSessionsFilterInput({ condition: null })).toBeNull();
  });

  it("reports the expected input shape for invalid dispatch input", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await setSessionsFilterAgentTool.dispatch({
      toolCall: {
        toolCallId: "set-sessions-filter-invalid",
        toolName: SET_SESSIONS_FILTER_TOOL_NAME,
        input: {},
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart: vi.fn(),
      agentStore: store,
      capabilities: createDefaultAgentCapabilities(),
    });

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SET_SESSIONS_FILTER_TOOL_NAME,
        errorText: `Invalid ${SET_SESSIONS_FILTER_TOOL_NAME} input. Expected { condition: string }.`,
      })
    );
  });

  it("dispatches valid input to the registered sessions filter client action", async () => {
    const store = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const action = vi.fn().mockResolvedValue({
      ok: true,
      output: "sessions filter changed",
    });
    store
      .getState()
      .registerClientAction(SET_SESSIONS_FILTER_TOOL_NAME, action);

    const input = { condition: "session_annotation['quality'] == 'good'" };

    await setSessionsFilterAgentTool.dispatch({
      toolCall: {
        toolCallId: "set-sessions-filter-valid",
        toolName: SET_SESSIONS_FILTER_TOOL_NAME,
        input,
      },
      sessionId: "session-1",
      addToolOutput,
      appendMessagePart: vi.fn(),
      agentStore: store,
      capabilities: createDefaultAgentCapabilities(),
    });

    expect(action).toHaveBeenCalledWith(input);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: SET_SESSIONS_FILTER_TOOL_NAME,
        output: "sessions filter changed",
      })
    );
  });
});
