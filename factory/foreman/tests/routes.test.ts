import { createHmac } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as receiveAnthropicWebhook } from "../src/app/api/anthropic/webhooks/route";
import { GET as checkHealth } from "../src/app/api/health/route";
import { POST as receiveSlackEvent } from "../src/app/api/slack/events/route";

const scheduling = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after: scheduling.after }));
const routing = vi.hoisted(() => ({
  findThread: vi.fn<() => Promise<{ session_id: string } | undefined>>(),
  foreman: vi.fn(async () => undefined),
  worker: vi.fn(async () => undefined),
}));
vi.mock("../src/db/client", () => ({
  getDatabase: () => ({
    selectFrom: () => ({
      select: () => ({
        where: () => ({ executeTakeFirst: routing.findThread }),
      }),
    }),
  }),
}));
vi.mock("../src/messages/foreman", () => ({
  relayForemanReply: routing.foreman,
}));
vi.mock("../src/workers/requests", () => ({
  relayWorkerReply: routing.worker,
}));

const signingSecret = "test-slack-signing-secret";
const webhookKey = `whsec_${Buffer.from("test-anthropic-webhook-signing-key").toString("base64")}`;

function createSlackRequest(payload: unknown): Request {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    body,
    headers: {
      "x-slack-signature": signature,
      "x-slack-request-timestamp": timestamp,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  routing.findThread.mockResolvedValue(undefined);
  for (const [key, value] of Object.entries({
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_BOT_TOKEN: "test",
    SLACK_BOT_USER_ID: "factory",
    SLACK_WORKSPACE_ID: "workspace",
    SLACK_ALLOWED_USER_IDS: "alex,sam",
    FACTORY_FOREMAN_AGENT_ID: "agent",
    FACTORY_FOREMAN_ENVIRONMENT_ID: "environment",
    ANTHROPIC_API_KEY: "test",
    ANTHROPIC_WEBHOOK_SIGNING_KEY: webhookKey,
    DATABASE_URL: "postgresql://localhost/test",
    FACTORY_MCP_URL: "https://factory.example.com/api/mcp",
    FACTORY_MCP_BEARER_SECRET: "a".repeat(32),
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Slack HTTP endpoint", () => {
  const envelope = {
    type: "event_callback",
    event_id: "event",
    team_id: "workspace",
    event: {
      type: "app_mention",
      user: "alex",
      channel: "channel",
      ts: "100.000100",
      text: "<@factory> hello",
    },
  };

  it("answers a signed URL verification challenge without scheduling agent work", async () => {
    const response = await receiveSlackEvent(
      createSlackRequest({ type: "url_verification", challenge: "challenge" })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "challenge" });
    expect(scheduling.after).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests and malformed signed payloads", async () => {
    expect(
      (
        await receiveSlackEvent(
          new Request("http://localhost/api/slack/events", {
            method: "POST",
            body: JSON.stringify(envelope),
          })
        )
      ).status
    ).toBe(401);
    expect(
      (await receiveSlackEvent(createSlackRequest({ type: "event_callback" })))
        .status
    ).toBe(400);
    expect(scheduling.after).not.toHaveBeenCalled();
  });

  it.each([
    ["FACTORY_MCP_URL", ""],
    ["FACTORY_MCP_URL", "http://factory.example.com/api/mcp"],
    ["FACTORY_MCP_BEARER_SECRET", ""],
    ["FACTORY_MCP_BEARER_SECRET", "short"],
  ])(
    "rejects Slack work before acknowledgement when %s is invalid",
    async (key, value) => {
      vi.stubEnv(key, value);
      const response = await receiveSlackEvent(createSlackRequest(envelope));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Factory MCP configuration is missing or invalid.",
      });
      expect(scheduling.after).not.toHaveBeenCalled();
    }
  );

  it("accepts authorized messages while ignoring other workspaces and participants", async () => {
    const response = await receiveSlackEvent(createSlackRequest(envelope));
    expect(response.status).toBe(200);
    expect(scheduling.after).toHaveBeenCalledTimes(1);
    scheduling.after.mockClear();
    await receiveSlackEvent(
      createSlackRequest({ ...envelope, team_id: "another-workspace" })
    );
    await receiveSlackEvent(
      createSlackRequest({
        ...envelope,
        event: { ...envelope.event, user: "stranger" },
      })
    );
    expect(scheduling.after).not.toHaveBeenCalled();
  });
});

describe("Anthropic HTTP endpoint", () => {
  it("rejects unsigned callbacks", async () => {
    const response = await receiveAnthropicWebhook(
      new Request("http://localhost/api/anthropic/webhooks", {
        method: "POST",
        body: "{}",
      })
    );
    expect(response.status).toBe(401);
    expect(scheduling.after).not.toHaveBeenCalled();
  });

  it("schedules only signature-verified idle callbacks", async () => {
    const body = JSON.stringify({
      id: "event",
      type: "event",
      created_at: new Date().toISOString(),
      data: {
        type: "session.status_idled",
        id: "session",
        organization_id: "org",
        workspace_id: "anthropic-workspace",
      },
    });
    const timestamp = new Date();
    const signature = new Webhook(webhookKey).sign("delivery", timestamp, body);
    const response = await receiveAnthropicWebhook(
      new Request("http://localhost/api/anthropic/webhooks", {
        method: "POST",
        body,
        headers: {
          "webhook-id": "delivery",
          "webhook-timestamp": Math.floor(
            timestamp.getTime() / 1000
          ).toString(),
          "webhook-signature": signature,
        },
      })
    );
    expect(response.status).toBe(200);
    expect(scheduling.after).toHaveBeenCalledTimes(1);
  });
});

it("exposes process health without credentials", async () => {
  expect(await checkHealth().json()).toEqual({ status: "ok" });
});

describe("shared session webhook", () => {
  it("rejects unsigned worker callbacks", async () => {
    expect(
      (
        await receiveAnthropicWebhook(
          new Request("https://factory.example.com/api/anthropic/webhooks", {
            method: "POST",
            body: "{}",
          })
        )
      ).status
    ).toBe(401);
    expect(scheduling.after).not.toHaveBeenCalled();
  });

  it.each(["session.status_idled", "session.status_terminated"])(
    "accepts signed %s callbacks only from the configured workspace",
    async (type) => {
      vi.stubEnv("ANTHROPIC_WORKSPACE_ID", "worker-workspace");
      for (const workspace of ["wrong-workspace", "worker-workspace"]) {
        const body = JSON.stringify({
          id: `event-${workspace}-${type}`,
          type: "event",
          created_at: new Date().toISOString(),
          data: {
            type,
            id: "worker-session",
            organization_id: "org",
            workspace_id: workspace,
          },
        });
        const timestamp = new Date();
        const response = await receiveAnthropicWebhook(
          new Request("https://factory.example.com/api/anthropic/webhooks", {
            method: "POST",
            body,
            headers: {
              "webhook-id": "worker-delivery",
              "webhook-timestamp": Math.floor(
                timestamp.getTime() / 1000
              ).toString(),
              "webhook-signature": new Webhook(webhookKey).sign(
                "worker-delivery",
                timestamp,
                body
              ),
            },
          })
        );
        expect(response.status).toBe(
          workspace === "worker-workspace" ? 200 : 403
        );
      }
      expect(scheduling.after).toHaveBeenCalledTimes(1);
    }
  );
});

it.each([true, false])(
  "routes a verified callback using the existing Foreman mapping (mapped=%s)",
  async (isForeman) => {
    routing.findThread.mockResolvedValue(
      isForeman ? { session_id: "session" } : undefined
    );
    const timestamp = new Date();
    const body = JSON.stringify({
      id: `routing-${isForeman}`,
      type: "event",
      created_at: timestamp.toISOString(),
      data: {
        type: "session.status_idled",
        id: "session",
        workspace_id: "workspace",
        organization_id: "org",
      },
    });
    const result = await receiveAnthropicWebhook(
      new Request("https://factory.example.com/api/anthropic/webhooks", {
        method: "POST",
        body,
        headers: {
          "webhook-id": "routing",
          "webhook-timestamp": Math.floor(
            timestamp.getTime() / 1000
          ).toString(),
          "webhook-signature": new Webhook(webhookKey).sign(
            "routing",
            timestamp,
            body
          ),
        },
      })
    );
    expect(result.status).toBe(200);
    await scheduling.after.mock.calls[0][0]();
    if (isForeman) {
      expect(routing.foreman).toHaveBeenCalledWith({
        sessionId: "session",
        completedAt: timestamp.toISOString(),
      });
      expect(routing.worker).not.toHaveBeenCalled();
    } else {
      expect(routing.worker).toHaveBeenCalledWith({
        workerId: "session",
        completedAt: timestamp.toISOString(),
      });
      expect(routing.foreman).not.toHaveBeenCalled();
    }
  }
);
