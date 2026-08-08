import { HttpResponse, http as mswHttp } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildGraphqlRequest,
  createApiCommand,
  isNonQuery,
} from "../src/commands/api";
import { renderCurlCommand } from "../src/curl";
import { setupMockPhoenixServer } from "./mockServer";
import { captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const GRAPHQL_URL = "http://localhost:6006/graphql";

/**
 * Register a handler for the Phoenix GraphQL endpoint (not part of the
 * OpenAPI spec, so it needs a raw msw handler) and return a capture object
 * recording every request that reaches it.
 */
function useGraphqlEndpoint(responseBody: Record<string, unknown>) {
  const captured: { count: number; bodies: unknown[] } = {
    count: 0,
    bodies: [],
  };
  mock.server.use(
    mswHttp.post(GRAPHQL_URL, async ({ request }) => {
      captured.count += 1;
      captured.bodies.push(await request.clone().json());
      return HttpResponse.json(responseBody);
    })
  );
  return captured;
}

describe("isNonQuery", () => {
  it("returns false for an anonymous shorthand query", () => {
    expect(
      isNonQuery({ query: "{ serverStatus { insufficientStorage } }" })
    ).toBe(false);
  });

  it("returns false for a named query", () => {
    expect(
      isNonQuery({
        query: "query GetProjects { projects { edges { node { name } } } }",
      })
    ).toBe(false);
  });

  it("returns true for an anonymous mutation", () => {
    expect(
      isNonQuery({ query: 'mutation { createProject(name: "x") { id } }' })
    ).toBe(true);
  });

  it("returns true for a named mutation", () => {
    expect(
      isNonQuery({
        query:
          "mutation CreateProject($name: String!) { createProject(name: $name) { id } }",
      })
    ).toBe(true);
  });

  it("returns true for a mutation with variables block", () => {
    expect(
      isNonQuery({
        query:
          "mutation($input: CreateInput!) { create(input: $input) { id } }",
      })
    ).toBe(true);
  });

  it("returns true for an anonymous subscription", () => {
    expect(isNonQuery({ query: "subscription { events { id } }" })).toBe(true);
  });

  it("returns true for a named subscription", () => {
    expect(
      isNonQuery({ query: "subscription OnEvent { events { id type } }" })
    ).toBe(true);
  });

  it("returns false when 'mutation' appears only in a # comment", () => {
    expect(
      isNonQuery({
        query:
          "# mutation DoSomething\n{ serverStatus { insufficientStorage } }",
      })
    ).toBe(false);
  });

  it("returns false when 'subscription' appears only in a # comment", () => {
    expect(
      isNonQuery({
        query:
          "# subscription OnEvent\n{ projects { edges { node { name } } } }",
      })
    ).toBe(false);
  });

  it("returns false when 'mutation' is part of a field name", () => {
    expect(isNonQuery({ query: "{ mutationLog { id type } }" })).toBe(false);
  });

  it("returns true for mutation with leading whitespace", () => {
    expect(isNonQuery({ query: "  mutation { x }" })).toBe(true);
  });

  it("returns true for subscription with leading whitespace", () => {
    expect(isNonQuery({ query: "  subscription { x }" })).toBe(true);
  });
});

describe("buildGraphqlRequest", () => {
  it("builds the same request shape used by the live command", () => {
    const request = buildGraphqlRequest({
      query: "{ projects { edges { node { name } } } }",
      config: {
        endpoint: "http://localhost:6006/",
        apiKey: "secret-token",
        headers: {
          "X-Trace": "enabled",
        },
      },
    });

    expect(request).toEqual({
      url: "http://localhost:6006/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace": "enabled",
        Authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        query: "{ projects { edges { node { name } } } }",
      }),
    });
  });
});

describe("renderCurlCommand", () => {
  it("renders multiline curl output with masked auth by default", () => {
    const command = renderCurlCommand({
      method: "POST",
      url: "http://localhost:6006/graphql",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        query: '{ project(name: "Bob\'s") { name } }',
      }),
      maskTokens: true,
    });

    expect(command).toContain("curl \\");
    expect(command).toContain("  -X POST \\");
    expect(command).toContain(
      "  -H 'Authorization: Bearer ************************************' \\"
    );
    expect(command).toContain("Bob'\"'\"'s");
    expect(command).toContain("  'http://localhost:6006/graphql'");
  });

  it("reveals the raw token when masking is disabled", () => {
    const command = renderCurlCommand({
      method: "POST",
      url: "http://localhost:6006/graphql",
      headers: {
        Authorization: "Bearer secret-token",
      },
      maskTokens: false,
    });

    expect(command).toContain("Authorization: Bearer secret-token");
  });

  it("masks non-bearer authorization headers too", () => {
    const command = renderCurlCommand({
      method: "POST",
      url: "http://localhost:6006/graphql",
      headers: {
        Authorization: "Basic abc123",
      },
      maskTokens: true,
    });

    expect(command).toContain(
      "  -H 'Authorization: Basic ************************************' \\"
    );
    expect(command).not.toContain("Basic abc123");
  });

  it("normalizes mixed-case duplicate headers the same way fetch does", () => {
    const command = renderCurlCommand({
      method: "POST",
      url: "http://localhost:6006/graphql",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer env-secret",
        Authorization: "Bearer cli-secret",
        "content-type": "application/custom+json",
      },
      maskTokens: false,
    });

    expect(command).toContain(
      "  -H 'authorization: Bearer env-secret, Bearer cli-secret' \\"
    );
    expect(command).toContain(
      "  -H 'Content-Type: application/json, application/custom+json' \\"
    );
    expect(command).not.toContain("  -H 'Authorization: Bearer cli-secret' \\");
    expect(command).not.toContain(
      "  -H 'content-type: application/custom+json' \\"
    );
  });
});

describe("api graphql command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes fetch in normal mode", async () => {
    const graphqlCapture = useGraphqlEndpoint({
      data: {
        projects: {
          edges: [],
        },
      },
    });
    const io = captureCliOutput();

    await createApiCommand().parseAsync(
      [
        "graphql",
        "{ projects { edges { node { name } } } }",
        "--endpoint",
        "http://localhost:6006",
      ],
      { from: "user" }
    );

    expect(graphqlCapture.count).toBe(1);
    expect(graphqlCapture.bodies[0]).toEqual({
      query: "{ projects { edges { node { name } } } }",
    });
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify(
        {
          data: {
            projects: {
              edges: [],
            },
          },
        },
        null,
        2
      )
    );
    expect(io.stderr).not.toHaveBeenCalled();
  });

  it("prints curl and does not execute fetch when --curl is set", async () => {
    const graphqlCapture = useGraphqlEndpoint({ data: {} });
    const io = captureCliOutput();

    await createApiCommand().parseAsync(
      [
        "graphql",
        "{ projects { edges { node { name } } } }",
        "--endpoint",
        "http://localhost:6006",
        "--api-key",
        "secret-token",
        "--curl",
      ],
      { from: "user" }
    );

    expect(graphqlCapture.count).toBe(0);
    expect(io.stderr).not.toHaveBeenCalled();
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining("curl \\"));
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining("  -X POST \\")
    );
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining("  -H 'Content-Type: application/json' \\\n")
    );
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining(
        "  -H 'Authorization: Bearer ************************************' \\\n"
      )
    );
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining(
        `  --data-raw '${JSON.stringify({
          query: "{ projects { edges { node { name } } } }",
        })}' \\`
      )
    );
    expect(io.stdout).toHaveBeenCalledWith(
      expect.stringContaining("  'http://localhost:6006/graphql'")
    );
  });

  it("rejects --show-token when --curl is not set", async () => {
    const graphqlCapture = useGraphqlEndpoint({ data: {} });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createApiCommand().parseAsync(
        [
          "graphql",
          "{ projects { edges { node { name } } } }",
          "--endpoint",
          "http://localhost:6006",
          "--show-token",
        ],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:1");

    expect(graphqlCapture.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      "Error: --show-token can only be used with --curl."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("still rejects mutations in curl mode", async () => {
    const graphqlCapture = useGraphqlEndpoint({ data: {} });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createApiCommand().parseAsync(
        [
          "graphql",
          'mutation { createProject(name: "x") { id } }',
          "--endpoint",
          "http://localhost:6006",
          "--curl",
        ],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:1");

    expect(graphqlCapture.count).toBe(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      "Error: Only queries are permitted. Mutations and subscriptions are not allowed."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
