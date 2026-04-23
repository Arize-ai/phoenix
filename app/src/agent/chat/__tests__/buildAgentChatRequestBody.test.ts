import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { AgentObservabilitySettings } from "@phoenix/store/agentStore";

import { buildAgentChatRequestBody } from "../buildAgentChatRequestBody";

const baseObservability: AgentObservabilitySettings = {
  storeLocalTraces: true,
  exportRemoteTraces: false,
  hasAcknowledgedConsent: true,
};

const baseCapabilities: AgentCapabilities = createDefaultAgentCapabilities();

describe("buildAgentChatRequestBody", () => {
  it("includes the contexts array in the request body", () => {
    const contexts: AgentContext[] = [
      { type: "project", projectId: "P1" },
      { type: "trace", projectId: "P1", traceId: "T1" },
    ];
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "chat-1",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
      systemPrompt: "You are helpful.",
      sessionId: null,
      capabilities: baseCapabilities,
      observability: baseObservability,
      hasRemoteCollector: false,
      contexts,
    });
    expect(body.contexts).toEqual(contexts);
  });

  it("sends an empty contexts array when no context is advertised", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "chat-1",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
      systemPrompt: "You are helpful.",
      sessionId: null,
      capabilities: baseCapabilities,
      observability: baseObservability,
      hasRemoteCollector: false,
      contexts: [],
    });
    expect(body.contexts).toEqual([]);
  });
});
