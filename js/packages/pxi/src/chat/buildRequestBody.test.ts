import { describe, expect, it } from "vitest";

import { buildRequestBody } from "./buildRequestBody";
import type { AgentUIMessage, ModelSelection } from "./types";

const model: ModelSelection = {
  providerType: "builtin",
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
};

const messages: AgentUIMessage[] = [
  { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
];

describe("buildRequestBody", () => {
  it("builds a submit-message with model, history, and app context", () => {
    const body = buildRequestBody({
      id: "session-1",
      messages,
      trigger: "submit-message",
      messageId: undefined,
      model,
    });

    expect(body.trigger).toBe("submit-message");
    expect(body.id).toBe("session-1");
    expect(body.model).toEqual(model);
    expect(body.messages).toHaveLength(1);

    const appContext = body.contexts?.find((context) => context.type === "app");
    expect(appContext).toBeDefined();
    expect(
      typeof (appContext as { currentDateTime?: unknown }).currentDateTime
    ).toBe("string");
    expect(typeof (appContext as { timeZone?: unknown }).timeZone).toBe(
      "string"
    );
  });

  it("carries messageId on a regenerate-message", () => {
    const body = buildRequestBody({
      id: "session-1",
      messages,
      trigger: "regenerate-message",
      messageId: "m1",
      model,
    });

    expect(body.trigger).toBe("regenerate-message");
    expect((body as { messageId?: string | null }).messageId).toBe("m1");
  });
});
