import { refreshAgentSessionContext } from "@phoenix/agent/context/refreshAgentContext";
import { getOrCreateBashToolRuntime } from "@phoenix/agent/tools/bash/bashToolSessionRegistry";

vi.mock("@phoenix/authFetch", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@phoenix/authFetch";

const mockedAuthFetch = vi.mocked(authFetch);

function createGraphQLResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("refreshAgentSessionContext", () => {
  beforeEach(() => {
    mockedAuthFetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { query: string };

      if (body.query.includes("AgentProjectSummaryContextQuery")) {
        return createGraphQLResponse({
          project: {
            __typename: "Project",
            id: "project-1",
            name: "Demo Project",
            traceCount: 12,
            spanCount: 44,
          },
        });
      }

      if (body.query.includes("AgentProjectSpansContextQuery")) {
        return createGraphQLResponse({
          project: {
            __typename: "Project",
            spans: {
              edges: [
                {
                  node: {
                    id: "span-node-1",
                    spanId: "span-1",
                    name: "root span",
                    spanKind: "CHAIN",
                    statusCode: "OK",
                    startTime: "2026-03-17T12:00:00.000Z",
                    latencyMs: 25,
                    tokenCountTotal: 10,
                    cumulativeTokenCountTotal: 10,
                    input: { value: "input" },
                    output: { value: "output" },
                    trace: {
                      id: "trace-node-1",
                      traceId: "trace-1",
                      costSummary: { total: { cost: 1.2 } },
                    },
                  },
                },
              ],
            },
          },
        });
      }

      if (body.query.includes("AgentProjectTracesContextQuery")) {
        return createGraphQLResponse({
          project: {
            __typename: "Project",
            rootSpans: {
              edges: [
                {
                  node: {
                    id: "span-node-1",
                    spanId: "span-1",
                    name: "root span",
                    spanKind: "CHAIN",
                    statusCode: "OK",
                    startTime: "2026-03-17T12:00:00.000Z",
                    endTime: "2026-03-17T12:00:01.000Z",
                    latencyMs: 25,
                    cumulativeTokenCountTotal: 10,
                    input: { value: "input" },
                    output: { value: "output" },
                    trace: {
                      id: "trace-node-1",
                      traceId: "trace-1",
                      numSpans: 3,
                      costSummary: { total: { cost: 1.2 } },
                    },
                  },
                },
              ],
            },
          },
        });
      }

      if (body.query.includes("AgentProjectSessionsContextQuery")) {
        return createGraphQLResponse({
          project: {
            __typename: "Project",
            sessions: {
              edges: [
                {
                  node: {
                    id: "session-node-1",
                    sessionId: "session-1",
                    numTraces: 2,
                    startTime: "2026-03-17T12:00:00.000Z",
                    endTime: "2026-03-17T12:05:00.000Z",
                    firstInput: { value: "hello" },
                    lastOutput: { value: "world" },
                    tokenUsage: { total: 15 },
                    traceLatencyMsP50: 10,
                    traceLatencyMsP99: 30,
                    costSummary: { total: { cost: 1.5 } },
                  },
                },
              ],
            },
          },
        });
      }

      throw new Error(`Unexpected query: ${body.query}`);
    });
  });

  afterEach(() => {
    mockedAuthFetch.mockReset();
  });

  it("injects real page context, preserves workspace writes, and blocks phoenix mutations", async () => {
    await refreshAgentSessionContext({
      sessionId: "session-project",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        pageKind: "project",
        projectId: "project-1",
        traceId: null,
        projectTab: "spans",
        timeRange: {
          timeRangeKey: "7d",
          start: "2026-03-10T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    const runtime = await getOrCreateBashToolRuntime("session-project");
    const projectJson = await runtime.executeCommand(
      "cat /phoenix/projects/project-1/project.json"
    );
    const spansTable = await runtime.executeCommand(
      "cat /phoenix/projects/project-1/tables/spans.jsonl"
    );
    const workspaceWrite = await runtime.executeCommand(
      "printf 'ok' > /home/user/workspace/note.txt && cat /home/user/workspace/note.txt"
    );

    expect(projectJson.stdout).toContain("Demo Project");
    expect(spansTable.stdout).toContain("root span");
    await expect(
      runtime.executeCommand(
        "printf 'nope' > /phoenix/projects/project-1/project.json"
      )
    ).rejects.toThrow("read-only");
    expect(workspaceWrite.stdout).toContain("ok");
  });

  it("overwrites /phoenix on manual refresh while preserving workspace files", async () => {
    await refreshAgentSessionContext({
      sessionId: "session-refresh",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        pageKind: "project",
        projectId: "project-1",
        traceId: null,
        projectTab: "spans",
        timeRange: {
          timeRangeKey: "7d",
          start: "2026-03-10T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    const initialRuntime = await getOrCreateBashToolRuntime("session-refresh");
    await initialRuntime.executeCommand(
      "printf 'workspace' > /home/user/workspace/keep.txt"
    );

    await refreshAgentSessionContext({
      sessionId: "session-refresh",
      refreshReason: "manual",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        pageKind: "project",
        projectId: "project-1",
        traceId: null,
        projectTab: "spans",
        timeRange: {
          timeRangeKey: "1d",
          start: "2026-03-16T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    const refreshedRuntime =
      await getOrCreateBashToolRuntime("session-refresh");
    const workspaceFile = await refreshedRuntime.executeCommand(
      "cat /home/user/workspace/keep.txt"
    );
    const metadata = await refreshedRuntime.executeCommand(
      "cat /phoenix/_meta/context.json"
    );

    expect(workspaceFile.stdout).toContain("workspace");
    expect(metadata.stdout).toContain('"refreshReason": "manual"');
    expect(metadata.stdout).toContain('"timeRangeKey": "1d"');
  });

  it("skips replacing /phoenix when the refresh becomes stale", async () => {
    await refreshAgentSessionContext({
      sessionId: "session-stale-refresh",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        pageKind: "project",
        projectId: "project-1",
        traceId: null,
        projectTab: "spans",
        timeRange: {
          timeRangeKey: "7d",
          start: "2026-03-10T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    await refreshAgentSessionContext({
      sessionId: "session-stale-refresh",
      refreshReason: "time-range-change",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        pageKind: "project",
        projectId: "project-1",
        traceId: null,
        projectTab: "spans",
        timeRange: {
          timeRangeKey: "1d",
          start: "2026-03-16T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
      canReplacePhoenixContext: () => false,
    });

    const runtime = await getOrCreateBashToolRuntime("session-stale-refresh");
    const metadata = await runtime.executeCommand(
      "cat /phoenix/_meta/context.json"
    );

    expect(metadata.stdout).toContain('"refreshReason": "navigation"');
    expect(metadata.stdout).toContain('"timeRangeKey": "7d"');
    expect(metadata.stdout).not.toContain('"timeRangeKey": "1d"');
  });
});
