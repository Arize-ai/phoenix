import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceConfig } from "../src/config";
import { getDatabase } from "../src/db/client";
import {
  deliverThreadMessage,
  relayCoordinatorReply,
} from "../src/messages/coordinator";

const upstream = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "coordinator-test" })),
  send: vi.fn(async () => ({})),
  read: vi.fn(async () => [
    {
      user_id: "alex",
      text: "Earlier discussion",
      message_timestamp: "99.000100",
    },
  ]),
  list: vi.fn(async () => ({
    data: [
      {
        id: "reply-test",
        type: "agent.message",
        content: [{ type: "text", text: "Hello from Factory" }],
      },
    ],
  })),
  post: vi.fn(async () => undefined),
}));
vi.mock("../src/anthropic/client", () => ({
  getAnthropicClient: () => ({
    beta: {
      sessions: {
        create: upstream.create,
        events: { send: upstream.send, list: upstream.list },
      },
    },
  }),
}));
vi.mock("../src/slack/client", () => ({
  readSlackThread: upstream.read,
  postThreadReply: upstream.post,
}));

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  vi.clearAllMocks();
  await pool.query(
    "TRUNCATE slack_threads, issues_sessions, pull_requests_sessions, sessions, issues, pull_requests, users, repositories CASCADE"
  );
});
afterAll(async () => {
  await pool.end();
  await getDatabase().destroy();
});

function createNodeId({ type, id }: { type: string; id: number }): string {
  return Buffer.from(`010:${type}${id}`).toString("base64");
}

async function seedWork(): Promise<void> {
  await pool.query(
    "INSERT INTO repositories(node_id, owner, name) VALUES ($1, 'Arize-ai', 'phoenix')",
    [createNodeId({ type: "Repository", id: 1 })]
  );
  await pool.query(
    "INSERT INTO issues(node_id, repo_id, number, title, github_created_at) VALUES ($1, 1, 10, 'Issue', now())",
    [createNodeId({ type: "Issue", id: 2 })]
  );
  await pool.query(
    "INSERT INTO pull_requests(node_id, repo_id, number, title, github_created_at) VALUES ($1, 1, 20, 'PR', now())",
    [createNodeId({ type: "PullRequest", id: 3 })]
  );
  await pool.query(
    "INSERT INTO sessions(id, kind) VALUES ('coordinator', 'coordinator'), ('worker', 'worker')"
  );
}

describe("GitHub identities", () => {
  it.each([
    ["MDEwOlJlcG9zaXRvcnkyMzM3NjU1Mzc=", "233765537"],
    ["R_kgDOIZ8Rag", "564072810"],
    ["I_kwDOIZ8Ras8AAAABgbuqyQ", "6471527113"],
    ["PR_kwDOIZ8Ras8AAAABQJcJgw", "5378607491"],
  ])("decodes %s", async (nodeId, expected) => {
    const result = await pool.query<{ id: string }>(
      "SELECT github_database_id($1)::text AS id",
      [nodeId]
    );
    expect(result.rows[0]?.id).toBe(expected);
  });

  it("derives omitted IDs and rejects mismatched IDs on insert and update", async () => {
    await seedWork();
    expect(
      (await pool.query<{ id: string }>("SELECT id FROM repositories")).rows[0]
        ?.id
    ).toBe("1");
    await expect(
      pool.query(
        "INSERT INTO repositories(id, node_id, owner, name) VALUES (99, $1, 'owner', 'repo')",
        [createNodeId({ type: "Repository", id: 4 })]
      )
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query("UPDATE issues SET id = 99 WHERE id = 2")
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query("UPDATE pull_requests SET node_id = $1 WHERE id = 3", [
        createNodeId({ type: "PullRequest", id: 4 }),
      ])
    ).rejects.toMatchObject({ code: "23514" });
  });
});

describe("typed session relationships", () => {
  it("allows coordinator threads and worker crosswalks", async () => {
    await seedWork();
    await pool.query(
      "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', '100.000100', 'coordinator')"
    );
    await pool.query(
      "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'worker')"
    );
    await pool.query(
      "INSERT INTO pull_requests_sessions(pull_request_id, session_id) VALUES (3, 'worker')"
    );
    expect(
      (await pool.query("SELECT session_id FROM slack_threads")).rowCount
    ).toBe(1);
  });

  it("rejects wrong-kind references, including attempts to bypass the kind check", async () => {
    await seedWork();
    await expect(
      pool.query(
        "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', '100', 'worker')"
      )
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'coordinator')"
      )
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO pull_requests_sessions(pull_request_id, session_id) VALUES (3, 'coordinator')"
      )
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id, session_kind) VALUES ('workspace', 'channel', '100', 'worker', 'worker')"
      )
    ).rejects.toMatchObject({ code: "23514" });
    await pool.query(
      "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'worker')"
    );
    await expect(
      pool.query("UPDATE sessions SET kind = 'coordinator' WHERE id = 'worker'")
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces thread and crosswalk uniqueness and keeps timestamps opaque", async () => {
    await seedWork();
    await pool.query(
      "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', 'opaque-slack-timestamp', 'coordinator')"
    );
    await expect(
      pool.query("INSERT INTO slack_threads SELECT * FROM slack_threads")
    ).rejects.toMatchObject({ code: "23505" });
    await pool.query(
      "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'worker')"
    );
    await expect(
      pool.query(
        "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'worker')"
      )
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("persistent thread routing", () => {
  const message = {
    workspaceId: "workspace",
    channelId: "channel",
    threadTimestamp: "100.000100",
    messageTimestamp: "100.000100",
    userId: "alex",
    text: "<@factory> help",
    isMention: true,
  };
  function createConfig(): ServiceConfig {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required.");
    return {
      SLACK_SIGNING_SECRET: "test",
      SLACK_BOT_TOKEN: "test",
      SLACK_BOT_USER_ID: "factory",
      SLACK_WORKSPACE_ID: "workspace",
      SLACK_ALLOWED_USER_IDS: new Set(["alex", "sam"]),
      FACTORY_COORDINATOR_AGENT_ID: "agent",
      FACTORY_COORDINATOR_ENVIRONMENT_ID: "environment",
      ANTHROPIC_API_KEY: "test",
      ANTHROPIC_WEBHOOK_SIGNING_KEY: "test",
      DATABASE_URL: databaseUrl,
    };
  }

  it("creates one coordinator for concurrent mentions, then forwards another person's ordinary reply", async () => {
    const config = createConfig();
    await Promise.all([
      deliverThreadMessage({ message, config }),
      deliverThreadMessage({
        message: { ...message, messageTimestamp: "101.000100" },
        config,
      }),
    ]);
    await deliverThreadMessage({
      message: {
        ...message,
        userId: "sam",
        text: "Check exports",
        isMention: false,
        messageTimestamp: "102.000100",
      },
      config,
    });
    expect(upstream.create).toHaveBeenCalledTimes(1);
    expect(upstream.read).toHaveBeenCalledTimes(1);
    expect(upstream.send).toHaveBeenCalledTimes(3);
    expect(upstream.send.mock.calls[2]).toEqual([
      "coordinator-test",
      expect.objectContaining({
        events: [
          expect.objectContaining({
            content: [
              {
                type: "text",
                text: expect.stringContaining('"user_id":"sam"'),
              },
            ],
          }),
        ],
      }),
    ]);
    const result = await pool.query("SELECT session_id FROM slack_threads");
    expect(result.rows).toEqual([{ session_id: "coordinator-test" }]);
  });

  it("ignores ordinary messages in untracked threads", async () => {
    await deliverThreadMessage({
      message: { ...message, isMention: false },
      config: createConfig(),
    });
    expect(upstream.create).not.toHaveBeenCalled();
    expect(upstream.send).not.toHaveBeenCalled();
  });

  it("posts the latest agent reply to its mapped thread once", async () => {
    await deliverThreadMessage({ message, config: createConfig() });
    await relayCoordinatorReply("coordinator-test");
    await relayCoordinatorReply("coordinator-test");
    expect(upstream.post).toHaveBeenCalledTimes(1);
    expect(upstream.post).toHaveBeenCalledWith({
      channelId: "channel",
      threadTimestamp: "100.000100",
      text: "Hello from Factory",
    });
  });

  it("does not relay messages from sessions outside the service", async () => {
    await relayCoordinatorReply("untracked-session");
    expect(upstream.list).not.toHaveBeenCalled();
    expect(upstream.post).not.toHaveBeenCalled();
  });
});
