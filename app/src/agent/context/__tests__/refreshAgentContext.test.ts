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
    mockedAuthFetch.mockReset();
  });

  it("injects page metadata, preserves workspace writes, and blocks phoenix mutations", async () => {
    await refreshAgentSessionContext({
      sessionId: "session-project",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
        timeRange: {
          timeRangeKey: "7d",
          start: "2026-03-10T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    const runtime = await getOrCreateBashToolRuntime("session-project");
    const metadata = await runtime.executeCommand(
      "cat /phoenix/_meta/context.json"
    );
    const pageContext = await runtime.executeCommand(
      "cat /phoenix/page-context.json"
    );
    const schema = await runtime.executeCommand(
      "test -s /phoenix/graphql/schema.graphql && printf ok"
    );
    const workspaceWrite = await runtime.executeCommand(
      "printf 'ok' > /home/user/workspace/note.txt && cat /home/user/workspace/note.txt"
    );

    expect(metadata.stdout).toContain('"params": {');
    expect(metadata.stdout).toContain('"projectId": "project-1"');
    expect(metadata.stdout).toContain('"timeRangeKey": "7d"');
    expect(pageContext.stdout).toContain('"routeMatches"');
    expect(schema.stdout).toContain("ok");
    await expect(
      runtime.executeCommand("printf 'nope' > /phoenix/_meta/context.json")
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
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
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
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
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
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
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
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
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

  it("executes phoenix-gql queries from strings, stdin, and files", async () => {
    mockedAuthFetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables?: { id?: string };
      };

      if (body.query.includes("mutation")) {
        throw new Error("mutation should have been blocked before fetch");
      }

      if (body.query.includes("node(id: $id)")) {
        return createGraphQLResponse({
          node: {
            __typename: "Dataset",
            id: body.variables?.id ?? null,
            name: "Dataset A",
          },
        });
      }

      return createGraphQLResponse({
        projects: {
          edges: [{ node: { name: "Project Alpha" } }],
        },
      });
    });

    await refreshAgentSessionContext({
      sessionId: "session-phoenix-gql",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/datasets/RGF0YXNldDox/experiments",
        search: "?tab=overview",
        params: { datasetId: "RGF0YXNldDox" },
        searchParams: { tab: "overview" },
        routeMatches: [
          {
            id: "dataset-root",
            pathname: "/datasets/RGF0YXNldDox",
            params: { datasetId: "RGF0YXNldDox" },
          },
          {
            id: "dataset-experiments",
            pathname: "/datasets/RGF0YXNldDox/experiments",
            params: { datasetId: "RGF0YXNldDox" },
          },
        ],
        timeRange: null,
      },
    });

    const runtime = await getOrCreateBashToolRuntime("session-phoenix-gql");
    const gqlHelp = await runtime.executeCommand(
      "phoenix-gql query --variables '{}' --help"
    );
    const datasetRecipe = await runtime.executeCommand(
      "cat /phoenix/graphql/recipes/dataset-experiments.graphql"
    );

    const inlineResult = await runtime.executeCommand(
      `phoenix-gql '{ projects { edges { node { name } } } }' | jq -r '.data.projects.edges[0].node.name'`
    );
    await runtime.executeCommand(
      `cat <<'EOF' > /home/user/workspace/query.graphql
query DatasetById($id: ID!) {
  node(id: $id) {
    __typename
    ... on Dataset {
      id
      name
    }
  }
}
EOF`
    );
    await runtime.executeCommand(
      `cat <<'EOF' > /home/user/workspace/vars.json
{"id":"RGF0YXNldDox"}
EOF`
    );
    const fileResult = await runtime.executeCommand(
      `phoenix-gql /home/user/workspace/query.graphql --vars-file /home/user/workspace/vars.json --data-only | jq -r '.node.name'`
    );
    const spillResult = await runtime.executeCommand(
      `printf '{ projects { edges { node { name } } } }' | phoenix-gql --output /home/user/workspace/result.json`
    );
    const blockedMutation = await runtime.executeCommand(
      `phoenix-gql 'mutation { __typename }'`
    );

    expect(datasetRecipe.stdout).toContain("experiments(first: 10)");
    expect(gqlHelp.stdout).toContain("/phoenix/agent-start.md");
    expect(gqlHelp.stdout).toContain("Alias for --vars");
    expect(inlineResult.stdout).toContain("Project Alpha");
    expect(fileResult.stdout).toContain("Dataset A");
    expect(spillResult.stdout).toContain("/home/user/workspace/result.json");
    expect(blockedMutation.exitCode).toBe(1);
    expect(blockedMutation.stderr).toContain(
      "Only GraphQL queries are permitted"
    );
  });

  it("emits schema-safe project recipe variables and actionable graphql errors", async () => {
    await refreshAgentSessionContext({
      sessionId: "session-project-recipe-vars",
      refreshReason: "navigation",
      pageContext: {
        pathname: "/projects/project-1/spans",
        search: "",
        params: { projectId: "project-1" },
        searchParams: {},
        routeMatches: [
          {
            id: "project-spans",
            pathname: "/projects/project-1/spans",
            params: { projectId: "project-1" },
          },
        ],
        timeRange: {
          timeRangeKey: "7d",
          start: "2026-03-10T00:00:00.000Z",
          end: "2026-03-17T00:00:00.000Z",
        },
      },
    });

    mockedAuthFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          errors: [
            {
              message:
                'Field "timeRangeKey" is not defined by type "TimeRange"',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const runtime = await getOrCreateBashToolRuntime(
      "session-project-recipe-vars"
    );
    const varsFile = await runtime.executeCommand(
      "cat /phoenix/graphql/recipes/project-recipes.variables.json"
    );
    const gqlResult = await runtime.executeCommand(
      "phoenix-gql /phoenix/graphql/recipes/project-recent-traces.graphql --vars-file /phoenix/graphql/recipes/project-recipes.variables.json"
    );

    expect(varsFile.stdout).toContain('"start": "2026-03-10T00:00:00.000Z"');
    expect(varsFile.stdout).toContain('"end": "2026-03-17T00:00:00.000Z"');
    expect(varsFile.stdout).not.toContain("timeRangeKey");
    expect(gqlResult.exitCode).toBe(1);
    expect(gqlResult.stderr).toContain("GraphQL errors:");
    expect(gqlResult.stderr).toContain('Field "timeRangeKey" is not defined');
  });
});
