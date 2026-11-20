import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

import { POST as receiveMcpRequest } from "../src/app/api/mcp/route";
import { getDatabase } from "../src/db/client";
import { prepareMcpGrant } from "../src/mcp/oauth";
import { readSignedToken } from "../src/mcp/tokens";
import type * as WorkerClient from "../src/workers/client";
import {
  createReplyInstruction,
  relayWorkerReply,
  sendSessionMessage,
} from "../src/workers/requests";
import {
  findSessions,
  findSessionsSchema,
  getSession,
} from "../src/workers/sessions";
import { startSession, startSessionSchema } from "../src/workers/start";

const upstream = vi.hoisted(() => ({
  retrieve: vi.fn(),
  list: vi.fn(),
  events: vi.fn(),
  send: vi.fn(),
  reply: vi.fn(),
  github: vi.fn(),
  after: vi.fn(),
  readThread: vi.fn(),
}));
vi.mock("../src/slack/client", () => ({
  readSlackThread: upstream.readThread,
}));
vi.mock("next/server", () => ({ after: upstream.after }));
vi.mock("../src/workers/client", async (importOriginal) => {
  const actual = await importOriginal<typeof WorkerClient>();
  return {
    ...actual,
    getWorkerClient: () => ({
      beta: {
        sessions: {
          retrieve: upstream.retrieve,
          list: upstream.list,
          events: { list: upstream.events, send: upstream.send },
        },
      },
    }),
    readWorkerSession: async (sessionId: string) => {
      const session = await upstream.retrieve(sessionId);
      actual.authorizeRepository(session.metadata.repo);
      if (!session.metadata.lane) throw new Error("Not a worker");
      return session;
    },
  };
});
vi.mock("../src/anthropic/client", () => ({
  getAnthropicClient: () => ({
    beta: { sessions: { events: { send: upstream.reply } } },
  }),
}));

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const worker = {
  id: "worker",
  title: "A worker",
  status: "idle",
  agent: { id: "worker-agent" },
  metadata: {
    repo: "Arize-ai/phoenix",
    lane: "bug",
    issues: "[42]",
    prs: "[77]",
  },
  created_at: "2026-11-19",
  updated_at: "2026-11-19",
};
let token: string;
beforeEach(async () => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({
    FACTORY_MCP_URL: "https://factory.example.com/api/mcp",
    FACTORY_MCP_BEARER_SECRET: "a".repeat(32),
    ANTHROPIC_API_KEY: "worker-test-key",
    ANTHROPIC_WORKSPACE_ID: "worker-workspace",
    SLACK_ALLOWED_USER_IDS: "alex,sam",
    FACTORY_GITHUB_TOKEN: "dispatcher-test-token",
    FACTORY_WORKFLOW_REF: "trusted-factory-ref",
    FACTORY_GITHUB_USERS: '{"alex":"alex-github","sam":"sam-github"}',
  }))
    vi.stubEnv(key, value);
  await pool.query("TRUNCATE slack_threads, sessions CASCADE");
  await pool.query(
    "INSERT INTO sessions(id,kind) VALUES ('foreman-a','foreman'),('foreman-b','foreman')"
  );
  await pool.query(
    "INSERT INTO slack_threads(workspace_id,channel_id,thread_timestamp,session_id) VALUES ('team','channel','1','foreman-a'),('team','channel','2','foreman-b')"
  );
  const grant = await prepareMcpGrant();
  await getDatabase()
    .insertInto("mcp_oauth_grants")
    .values({ ...grant.record, session_id: "foreman-a" })
    .execute();
  token = grant.auth.access_token;
  upstream.readThread.mockResolvedValue([
    { user_id: "alex", text: "Start a worker", message_timestamp: "1" },
  ]);
  upstream.retrieve.mockResolvedValue(worker);
  upstream.list.mockResolvedValue({ data: [worker], next_page: null });
  upstream.events.mockResolvedValue({ data: [], next_page: null });
  upstream.send.mockResolvedValue({
    data: [{ type: "user.message", id: "accepted-input" }],
  });
  upstream.reply.mockResolvedValue({});
  vi.stubGlobal("fetch", upstream.github);
  upstream.github.mockImplementation(
    async (_url: string, options: RequestInit): Promise<Response> =>
      Response.json(
        options.method === "POST"
          ? { workflow_run_id: 123 }
          : { permission: "write" }
      )
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await pool.end();
  await getDatabase().destroy();
});

async function callMcp({
  bearer = token,
  origin,
  method = "tools/list",
  params = {},
}: {
  bearer?: string;
  origin?: string;
  method?: string;
  params?: object;
} = {}): Promise<Response> {
  return receiveMcpRequest(
    new Request("https://factory.example.com/api/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-11-25",
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  );
}

async function readRpc(response: Response): Promise<{
  result: {
    tools?: { name: string }[];
    content?: { text: string }[];
    isError?: boolean;
  };
}> {
  const text = await response.text();
  const data =
    text.startsWith("event:") || text.startsWith("data:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6)
      : text;
  return JSON.parse(data ?? "null");
}

function forgeCallerToken(token: string): string {
  const [header, payload, signature] = token.split(".");
  const claims: object = JSON.parse(
    Buffer.from(payload, "base64url").toString()
  );
  return `${header}.${Buffer.from(JSON.stringify({ ...claims, sub: "forged" })).toString("base64url")}.${signature}`;
}

function forgeToken(token: string): string {
  const [payload, signature] = token.split(".");
  const claims: object = JSON.parse(
    Buffer.from(payload, "base64url").toString()
  );
  return `${Buffer.from(JSON.stringify({ ...claims, thread_timestamp: "2", foreman_id: "forged" })).toString("base64url")}.${signature}`;
}

it("requires a signed Foreman token, rejecting shared secrets, altered claims, reply tokens and untrusted origins", async () => {
  for (const bearer of [
    "",
    "a".repeat(32),
    forgeCallerToken(token),
    replyLine().slice("REPLYING_TO: ".length),
  ])
    expect((await callMcp({ bearer })).status).toBe(401);
  expect((await callMcp({ origin: "https://evil.example" })).status).toBe(403);
  const response = await callMcp();
  expect(response.status).toBe(200);
  expect(
    (await readRpc(response)).result.tools?.map((tool) => tool.name)
  ).toEqual([
    "find_sessions",
    "get_session",
    "send_session_message",
    "start_session",
  ]);
});

it("binds tool writes to the authenticated Foreman and accepts queued messages while running", async () => {
  upstream.retrieve.mockResolvedValue({ ...worker, status: "running" });
  const response = await callMcp({
    method: "tools/call",
    params: {
      name: "send_session_message",
      arguments: {
        session_id: "worker",
        message: "Explain the PR",
        foremanId: "foreman-b",
      },
    },
  });
  expect(response.status).toBe(200);
  expect((await readRpc(response)).result.isError).not.toBe(true);
  const sent = upstream.send.mock.calls[0][1].events[0].content[0].text;
  const marker = sent.match(/REPLYING_TO: ([^\n]+)/)?.[1];
  expect(readSignedToken(marker)).toMatchObject({
    purpose: "reply",
    foreman_id: "foreman-a",
    worker_id: "worker",
  });
  await sendSessionMessage({
    foremanId: "foreman-b",
    sessionId: "worker",
    message: "Another request",
  });
  expect(upstream.send).toHaveBeenCalledTimes(2);
});

it("returns paged native metadata matches without requiring the local issue/PR index", async () => {
  expect(
    (
      await findSessions(
        findSessionsSchema.parse({ repo: "Arize-ai/phoenix", pr_number: 77 })
      )
    ).sessions
  ).toHaveLength(1);
  upstream.list.mockResolvedValue({
    data: [worker],
    next_page: "next-native-page",
  });
  const empty = await findSessions(
    findSessionsSchema.parse({
      repo: "Arize-ai/phoenix",
      issue_number: 999,
      cursor: "previous-page",
    })
  );
  expect(empty).toMatchObject({
    sessions: [],
    next_cursor: "next-native-page",
    scanned: 1,
  });
  expect(upstream.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: "previous-page" })
  );
  expect(findSessionsSchema.safeParse({ issue_number: 42 }).success).toBe(
    false
  );
  await expect(
    findSessions(findSessionsSchema.parse({ repo: "other/private" }))
  ).rejects.toThrow("not available");
});

it("paginates conversation text without returning session credentials or resources", async () => {
  upstream.retrieve.mockResolvedValue({
    ...worker,
    resources: [{ authorization_token: "must-not-return" }],
  });
  upstream.events.mockResolvedValue({
    data: [
      {
        id: "answer",
        type: "agent.message",
        content: [{ type: "text", text: "Summary" }, { type: "image" }],
      },
    ],
    next_page: "older",
  });
  const result = await getSession({
    session_id: "worker",
    limit: 5,
    before_cursor: "page",
  });
  expect(result.messages[0]).toMatchObject({
    text: "Summary",
    role: "assistant",
  });
  expect(result.before_cursor).toBe("older");
  expect(JSON.stringify(result)).not.toContain("must-not-return");
  expect(upstream.events).toHaveBeenCalledWith(
    "worker",
    expect.objectContaining({ page: "page", limit: 5 })
  );
});

function replyLine({
  foremanId = "foreman-a",
  workerId = "worker",
}: { foremanId?: string; workerId?: string } = {}): string {
  const reply = createReplyInstruction({
    foremanId,
    workerId,
    message: "Question",
  });
  return reply.instruction.match(/^REPLYING_TO: .+$/m)![0];
}

function agentReply({ id, text }: { id: string; text: string }): object {
  return { id, type: "agent.message", content: [{ type: "text", text }] };
}

it("routes multiple tagged answers across messages and inside a batched response to their Foremen", async () => {
  const first = replyLine();
  const second = replyLine({ foremanId: "foreman-b" });
  const third = replyLine();
  upstream.events.mockResolvedValue({
    data: [
      agentReply({
        id: "batch",
        text: `${second}\nAnswer B\n${third}\nAnswer A2`,
      }),
      agentReply({ id: "first", text: `${first}\nAnswer A1` }),
    ],
  });
  await relayWorkerReply({
    workerId: "worker",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(
    upstream.reply.mock.calls.map(([sessionId, payload]) => [
      sessionId,
      JSON.parse(payload.events[0].content[0].text).text,
    ])
  ).toEqual([
    ["foreman-a", "Answer A1"],
    ["foreman-b", "Answer B"],
    ["foreman-a", "Answer A2"],
  ]);
  expect(upstream.events).toHaveBeenCalledWith(
    "worker",
    expect.objectContaining({
      types: ["agent.message"],
      "created_at[lte]": "2026-11-19T20:00:00Z",
    })
  );
  await relayWorkerReply({
    workerId: "worker",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(upstream.reply).toHaveBeenCalledTimes(3);
});

it("ignores untagged, malformed, tampered and wrong-worker replies without guessing a destination", async () => {
  const marker = replyLine();
  upstream.events.mockResolvedValue({
    data: [
      agentReply({ id: "untagged", text: "A plain answer" }),
      agentReply({ id: "bad", text: "REPLYING_TO: invalid\nBad route" }),
      agentReply({
        id: "tampered",
        text: `REPLYING_TO: ${forgeToken(marker.slice("REPLYING_TO: ".length))}\nBad signature`,
      }),
      agentReply({
        id: "other-worker",
        text: `${replyLine({ workerId: "another-worker" })}\nWrong worker`,
      }),
    ],
  });
  await relayWorkerReply({
    workerId: "worker",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(upstream.reply).not.toHaveBeenCalled();
});

it("verifies a new start marker against the binding created in that worker's metadata", async () => {
  const reply = createReplyInstruction({
    foremanId: "foreman-b",
    message: "Fix",
  });
  const marker = reply.instruction.match(/^REPLYING_TO: .+$/m)![0];
  upstream.events.mockResolvedValue({
    data: [agentReply({ id: "new-worker", text: `${marker}\nDone` })],
  });
  await relayWorkerReply({
    workerId: "worker",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(upstream.reply).not.toHaveBeenCalled();
  upstream.retrieve.mockResolvedValue({
    ...worker,
    metadata: { ...worker.metadata, factory_reply_id: reply.requestId },
  });
  await relayWorkerReply({
    workerId: "worker",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(upstream.reply.mock.calls[0][0]).toBe("foreman-b");
});

it("surfaces send failures without retrying or claiming acceptance", async () => {
  upstream.send.mockRejectedValue(new Error("network timeout"));
  await expect(
    sendSessionMessage({
      foremanId: "foreman-a",
      sessionId: "worker",
      message: "Question",
    })
  ).rejects.toThrow("network timeout");
  expect(upstream.send).toHaveBeenCalledTimes(1);
});

it("ignores callbacks for sessions that are not Factory workers", async () => {
  upstream.retrieve.mockResolvedValue({ ...worker, metadata: {} });
  await relayWorkerReply({
    workerId: "unrelated",
    completedAt: "2026-11-19T20:00:00Z",
  });
  expect(upstream.events).not.toHaveBeenCalled();
  expect(upstream.reply).not.toHaveBeenCalled();
});

it("requires valid existing lane targets and server-configured GitHub identities", async () => {
  expect(
    startSessionSchema.safeParse({
      repo: "Arize-ai/phoenix",
      lane: "bug",
      instruction: "Fix it",
    }).success
  ).toBe(false);
  expect(
    startSessionSchema.safeParse({
      repo: "Arize-ai/phoenix",
      lane: "review",
      instruction: "Review",
      issue_numbers: [42],
    }).success
  ).toBe(false);
  vi.stubEnv("FACTORY_GITHUB_USERS", "{}");
  await expect(
    startSession({
      foremanId: "foreman-a",
      input: startSessionSchema.parse({
        repo: "Arize-ai/phoenix",
        lane: "bug",
        instruction: "Fix",
        issue_numbers: [42],
      }),
    })
  ).rejects.toThrow("configured GitHub identity");
  expect(upstream.github).not.toHaveBeenCalled();
});

it.each([
  ["bug", "factory-dispatch.yml", "issue"],
  ["feature", "factory-dispatch.yml", "issue"],
  ["docs", "factory-dispatch.yml", "issue"],
  ["review", "factory-review.yml", "pr"],
  ["finish", "factory-finish.yml", "pr"],
])(
  "queues %s on its existing workflow with the trusted ref and signed return instruction",
  async (lane, workflow, target) => {
    const result = await startSession({
      foremanId: "foreman-a",
      input: startSessionSchema.parse({
        repo: "Arize-ai/phoenix",
        lane,
        instruction: "Perform the requested work",
        ...(target === "pr" ? { pr_numbers: [42] } : { issue_numbers: [42] }),
      }),
    });
    expect(result).toMatchObject({
      workflow_run_id: 123,
      workflow_url: "https://github.com/Arize-ai/phoenix/actions/runs/123",
      status: "queued",
    });
    expect(result).not.toHaveProperty("session_id");
    expect(upstream.github).toHaveBeenCalledTimes(2);
    expect(upstream.github.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/Arize-ai/phoenix/collaborators/alex-github/permission"
    );
    const [url, options] = upstream.github.mock.calls[1];
    expect(url).toBe(
      `https://api.github.com/repos/Arize-ai/phoenix/actions/workflows/${workflow}/dispatches`
    );
    expect(options.redirect).toBe("error");
    expect(options.headers["x-github-api-version"]).toBe("2026-03-10");
    const dispatch = JSON.parse(options.body);
    expect(dispatch.ref).toBe("trusted-factory-ref");
    expect(dispatch.inputs[target]).toBe("42");
    const message = JSON.parse(dispatch.inputs.message_request);
    expect(message).toMatchObject({
      requesters: ["alex-github"],
      workspace_id: "worker-workspace",
      reply_binding: result.request_id,
      instruction: expect.stringContaining("Perform the requested work"),
    });
    const marker = message.instruction.match(/^REPLYING_TO: (.+)$/m)[1];
    expect(readSignedToken(marker)).toMatchObject({
      foreman_id: "foreman-a",
      request_id: result.request_id,
      is_start: true,
    });
  }
);

it("checks all permitted participants before dispatching and rejects insufficient repository access", async () => {
  upstream.readThread.mockResolvedValue([
    { user_id: "alex" },
    { user_id: "sam" },
  ]);
  upstream.github.mockResolvedValueOnce(Response.json({ permission: "write" }));
  upstream.github.mockResolvedValueOnce(Response.json({ permission: "read" }));
  await expect(
    startSession({
      foremanId: "foreman-a",
      input: startSessionSchema.parse({
        repo: "Arize-ai/phoenix",
        lane: "bug",
        instruction: "Fix",
        issue_numbers: [42],
      }),
    })
  ).rejects.toThrow("write access");
  expect(upstream.github).toHaveBeenCalledTimes(2);
  expect(
    upstream.github.mock.calls.every(([, options]) => options.method === "GET")
  ).toBe(true);
});

it.each(["write", "read"])(
  "checks all 101 participants and honors the last participant's %s permission",
  async (lastPermission) => {
    const participants = Array.from(
      { length: 101 },
      (_unused, index) => `member${index}`
    );
    vi.stubEnv("SLACK_ALLOWED_USER_IDS", participants.join(","));
    vi.stubEnv(
      "FACTORY_GITHUB_USERS",
      JSON.stringify(
        Object.fromEntries(
          participants.map((member) => [member, `${member}-github`])
        )
      )
    );
    upstream.readThread.mockResolvedValue(
      participants.map((user_id) => ({ user_id }))
    );
    upstream.github.mockImplementation(
      async (url: string, options: RequestInit): Promise<Response> =>
        Response.json(
          options.method === "POST"
            ? { workflow_run_id: 123 }
            : {
                permission: url.includes("member100-github")
                  ? lastPermission
                  : "write",
              }
        )
    );
    const started = startSession({
      foremanId: "foreman-a",
      input: startSessionSchema.parse({
        repo: "Arize-ai/phoenix",
        lane: "bug",
        instruction: "Fix",
        issue_numbers: [42],
      }),
    });
    if (lastPermission === "write")
      await expect(started).resolves.toMatchObject({ status: "queued" });
    else await expect(started).rejects.toThrow("write access");
    const permissionCalls = upstream.github.mock.calls.filter(
      ([, options]) => options.method === "GET"
    );
    expect(permissionCalls).toHaveLength(101);
    expect(
      upstream.github.mock.calls.filter(
        ([, options]) => options.method === "POST"
      )
    ).toHaveLength(lastPermission === "write" ? 1 : 0);
  }
);

it("does not retry an uncertain workflow dispatch or expose GitHub errors and credentials", async () => {
  upstream.github.mockResolvedValueOnce(Response.json({ permission: "write" }));
  upstream.github.mockRejectedValueOnce(
    new TypeError("dispatcher-test-token network failed")
  );
  await expect(
    startSession({
      foremanId: "foreman-a",
      input: startSessionSchema.parse({
        repo: "Arize-ai/phoenix",
        lane: "review",
        instruction: "Review",
        pr_numbers: [42],
      }),
    })
  ).rejects.toThrow("Check Actions before retrying");
  expect(upstream.github).toHaveBeenCalledTimes(2);
});

it("rejects forbidden repositories and missing dispatcher credentials before any GitHub request", async () => {
  const input = startSessionSchema.parse({
    repo: "other/private",
    lane: "bug",
    instruction: "Fix",
    issue_numbers: [42],
  });
  await expect(startSession({ foremanId: "foreman-a", input })).rejects.toThrow(
    "not available"
  );
  vi.stubEnv("FACTORY_GITHUB_TOKEN", "");
  await expect(
    startSession({
      foremanId: "foreman-a",
      input: { ...input, repo: "Arize-ai/phoenix" },
    })
  ).rejects.toThrow();
  expect(upstream.github).not.toHaveBeenCalled();
});

it.each(["", "{}", "not-json"])(
  "treats a successful dispatch with invalid response %j as uncertain without retrying",
  async (body) => {
    upstream.github.mockResolvedValueOnce(
      Response.json({ permission: "write" })
    );
    upstream.github.mockResolvedValueOnce(new Response(body, { status: 200 }));
    await expect(
      startSession({
        foremanId: "foreman-a",
        input: startSessionSchema.parse({
          repo: "Arize-ai/phoenix",
          lane: "bug",
          instruction: "Fix",
          issue_numbers: [42],
        }),
      })
    ).rejects.toThrow("delivery is uncertain");
    expect(upstream.github).toHaveBeenCalledTimes(2);
  }
);
