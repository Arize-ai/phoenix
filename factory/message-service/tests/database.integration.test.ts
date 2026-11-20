import { readFileSync } from "node:fs";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ServiceConfig } from "../src/config";
import { getDatabase } from "../src/db/client";
import { createMcpToken } from "../src/mcp/auth";
import {
  deliverThreadMessage,
  relayForemanReply,
} from "../src/messages/foreman";

const upstream = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "foreman-test" })),
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
  vault: vi.fn(async () => ({ id: "foreman-vault" })),
  credential: vi.fn(async () => ({})),
}));
vi.mock("../src/anthropic/client", () => ({
  getAnthropicClient: () => ({
    beta: {
      vaults: {
        create: upstream.vault,
        credentials: { create: upstream.credential },
      },
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
  vi.stubEnv("FACTORY_MCP_URL", "https://factory.example.com/api/mcp");
  vi.stubEnv("FACTORY_MCP_BEARER_SECRET", "a".repeat(32));
  await pool.query(
    "TRUNCATE slack_threads, issues_sessions, pull_requests_sessions, sessions, issues, pull_requests, users, repositories CASCADE"
  );
});
afterAll(async () => {
  await pool.end();
  await getDatabase().destroy();
});
afterEach(() => vi.unstubAllEnvs());

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
    "INSERT INTO sessions(id, kind) VALUES ('foreman', 'foreman'), ('worker', 'worker')"
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
  it("allows foreman threads and worker crosswalks", async () => {
    await seedWork();
    await pool.query(
      "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', '100.000100', 'foreman')"
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
        "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'foreman')"
      )
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO pull_requests_sessions(pull_request_id, session_id) VALUES (3, 'foreman')"
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
      pool.query("UPDATE sessions SET kind = 'foreman' WHERE id = 'worker'")
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces thread and crosswalk uniqueness and keeps timestamps opaque", async () => {
    await seedWork();
    await pool.query(
      "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', 'opaque-slack-timestamp', 'foreman')"
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

it("preserves existing thread and worker links when renaming session kinds and rolling back", async () => {
  await seedWork();
  await pool.query(
    "INSERT INTO slack_threads(workspace_id, channel_id, thread_timestamp, session_id) VALUES ('workspace', 'channel', '100.000100', 'foreman')"
  );
  await pool.query(
    "INSERT INTO issues_sessions(issue_id, session_id) VALUES (2, 'worker')"
  );
  await pool.query(
    "INSERT INTO pull_requests_sessions(pull_request_id, session_id) VALUES (3, 'worker')"
  );
  const migration = readFileSync(
    new URL(
      "../db/migrations/202611190002_rename_coordinator_to_foreman.sql",
      import.meta.url
    ),
    "utf8"
  );
  const [up, down] = migration.split("-- migrate:down");
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    for (const kind of ["coordinator", "foreman", "coordinator", "foreman"]) {
      await connection.query(kind === "coordinator" ? down : up);
      const thread = await connection.query(
        "SELECT threads.session_id, threads.session_kind FROM slack_threads AS threads JOIN sessions ON (sessions.id, sessions.kind) = (threads.session_id, threads.session_kind)"
      );
      expect(thread.rows).toEqual([
        { session_id: "foreman", session_kind: kind },
      ]);
      const issueLinks = await connection.query(
        "SELECT issue_id::text, session_id, session_kind FROM issues_sessions"
      );
      expect(issueLinks.rows).toEqual([
        { issue_id: "2", session_id: "worker", session_kind: "worker" },
      ]);
      const pullRequestLinks = await connection.query(
        "SELECT pull_request_id::text, session_id, session_kind FROM pull_requests_sessions"
      );
      expect(pullRequestLinks.rows).toEqual([
        { pull_request_id: "3", session_id: "worker", session_kind: "worker" },
      ]);
    }
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
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
      FACTORY_FOREMAN_AGENT_ID: "agent",
      FACTORY_FOREMAN_ENVIRONMENT_ID: "environment",
      ANTHROPIC_API_KEY: "test",
      ANTHROPIC_WEBHOOK_SIGNING_KEY: "test",
      DATABASE_URL: databaseUrl,
      FACTORY_MCP_URL: "https://factory.example.com/api/mcp",
      FACTORY_MCP_BEARER_SECRET: "a".repeat(32),
    };
  }

  it("creates one foreman for concurrent mentions, then forwards another person's ordinary reply", async () => {
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
      "foreman-test",
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
    expect(result.rows).toEqual([{ session_id: "foreman-test" }]);
  });

  it("fails before creating anything when MCP configuration is missing", async () => {
    vi.stubEnv("FACTORY_MCP_URL", "");
    await expect(
      deliverThreadMessage({ message, config: createConfig() })
    ).rejects.toThrow();
    expect(upstream.create).not.toHaveBeenCalled();
    expect(upstream.vault).not.toHaveBeenCalled();
    expect(upstream.send).not.toHaveBeenCalled();
  });

  it("attaches a signed Foreman credential before sending the first message without adding routing state to Postgres", async () => {
    await deliverThreadMessage({ message, config: createConfig() });
    expect(upstream.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vault_ids: ["foreman-vault"],
        agent: {
          type: "agent_with_overrides",
          id: "agent",
          mcp_servers: [
            {
              type: "url",
              name: "factory",
              url: "https://factory.example.com/api/mcp",
            },
          ],
        },
      })
    );
    expect(upstream.credential).toHaveBeenCalledWith(
      "foreman-vault",
      expect.objectContaining({
        auth: {
          type: "static_bearer",
          mcp_server_url: "https://factory.example.com/api/mcp",
          token: createMcpToken({
            workspace_id: "workspace",
            channel_id: "channel",
            thread_timestamp: "100.000100",
          }),
        },
      })
    );
    expect(upstream.vault.mock.invocationCallOrder[0]).toBeLessThan(
      upstream.credential.mock.invocationCallOrder[0]
    );
    expect(upstream.credential.mock.invocationCallOrder[0]).toBeLessThan(
      upstream.create.mock.invocationCallOrder[0]
    );
    expect(upstream.create.mock.invocationCallOrder[0]).toBeLessThan(
      upstream.send.mock.invocationCallOrder[0]
    );
    expect(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='slack_threads' AND column_name IN ('mcp_token_hash','participants')"
        )
      ).rows
    ).toEqual([]);
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
    await relayForemanReply({
      sessionId: "foreman-test",
      completedAt: "2026-11-20T02:00:00Z",
    });
    await relayForemanReply({
      sessionId: "foreman-test",
      completedAt: "2026-11-20T02:00:00Z",
    });
    expect(upstream.post).toHaveBeenCalledTimes(1);
    expect(upstream.post).toHaveBeenCalledWith({
      channelId: "channel",
      threadTimestamp: "100.000100",
      text: "Hello from Factory",
    });
  });

  it("posts both Foreman replies when callbacks overlap with later messages", async () => {
    await deliverThreadMessage({ message, config: createConfig() });
    const replies = {
      data: [
        {
          id: "reply-b",
          type: "agent.message",
          content: [{ type: "text", text: "Answer B" }],
        },
        {
          id: "reply-a",
          type: "agent.message",
          content: [{ type: "text", text: "Answer A" }],
        },
      ],
    };
    upstream.list.mockResolvedValueOnce(replies).mockResolvedValueOnce(replies);
    await relayForemanReply({
      sessionId: "foreman-test",
      completedAt: "2026-11-20T02:00:00Z",
    });
    await relayForemanReply({
      sessionId: "foreman-test",
      completedAt: "2026-11-20T02:00:00Z",
    });
    expect(upstream.post.mock.calls).toEqual([
      [
        {
          channelId: "channel",
          threadTimestamp: "100.000100",
          text: "Answer A",
        },
      ],
      [
        {
          channelId: "channel",
          threadTimestamp: "100.000100",
          text: "Answer B",
        },
      ],
    ]);
    expect(upstream.list).toHaveBeenCalledWith("foreman-test", {
      types: ["agent.message"],
      order: "desc",
      limit: 100,
      "created_at[lte]": "2026-11-20T02:00:00Z",
    });
  });

  it("does not relay messages from sessions outside the service", async () => {
    await relayForemanReply({
      sessionId: "untracked-session",
      completedAt: "2026-11-20T02:00:00Z",
    });
    expect(upstream.list).not.toHaveBeenCalled();
    expect(upstream.post).not.toHaveBeenCalled();
  });
});
