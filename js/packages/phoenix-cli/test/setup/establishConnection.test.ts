import { describe, expect, it } from "vitest";

import * as COPY from "../../src/setup/copy";
import { HeadlessInputError, SetupFatalError } from "../../src/setup/errors";
import {
  defaultProjectName,
  establishConnection,
  validateProjectName,
} from "../../src/setup/steps/establishConnection";
import {
  buildFakeDeps,
  fakeFetch,
  jsonResponse,
  resolveFakeInputs,
  scriptedPrompter,
} from "./fakes";

const ENDPOINT = "http://localhost:6006";

describe("validateProjectName", () => {
  it("rejects empty names and URL-hostile characters", () => {
    expect(validateProjectName("")).toBeDefined();
    expect(validateProjectName("  ")).toBeDefined();
    expect(validateProjectName("a/b")).toBeDefined();
    expect(validateProjectName("a?b")).toBeDefined();
    expect(validateProjectName("a#b")).toBeDefined();
    expect(validateProjectName("my-app")).toBeUndefined();
  });
});

describe("defaultProjectName", () => {
  it("uses the cwd basename", () => {
    expect(defaultProjectName("/home/user/my-app")).toBe("my-app");
  });
});

describe("establishConnection headless lanes", () => {
  it("auth-off names the project without touching the server", async () => {
    let requests = 0;
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => {
        requests += 1;
        return jsonResponse(200, {});
      }),
    });
    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: false,
      inputs: resolveFakeInputs(deps, { noInput: true, project: "my-app" }),
    });
    expect(connection).toEqual({ endpoint: ENDPOINT, projectName: "my-app" });
    expect(requests).toBe(0);
  });

  it("auth-off without a project exits INVALID_ARGUMENT", async () => {
    const deps = buildFakeDeps();
    await expect(
      establishConnection(deps, {
        endpoint: ENDPOINT,
        authEnabled: false,
        inputs: resolveFakeInputs(deps, { noInput: true }),
      })
    ).rejects.toThrow(HeadlessInputError);
  });

  it("auth-on requires PHOENIX_API_KEY", async () => {
    const deps = buildFakeDeps();
    await expect(
      establishConnection(deps, {
        endpoint: ENDPOINT,
        authEnabled: true,
        inputs: resolveFakeInputs(deps, { noInput: true, project: "my-app" }),
      })
    ).rejects.toThrow(HeadlessInputError);
  });

  it("auth-on verifies the key with a read-only bearer request", async () => {
    let sawBearer = false;
    let wrote = false;
    const deps = buildFakeDeps({
      context: { env: { PHOENIX_API_KEY: "sk-live" } },
      fetch: fakeFetch((_url, request) => {
        sawBearer = request.headers.get("authorization") === "Bearer sk-live";
        wrote = wrote || request.method === "POST";
        return jsonResponse(200, { data: [] });
      }),
    });
    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps, { noInput: true, project: "my-app" }),
    });
    expect(sawBearer).toBe(true);
    expect(wrote).toBe(false);
    expect(connection.apiKey).toBe("sk-live");
  });

  it("auth-on fails fast on a rejected key", async () => {
    const deps = buildFakeDeps({
      context: { env: { PHOENIX_API_KEY: "sk-bad" } },
      fetch: fakeFetch(() => jsonResponse(401, { detail: "unauthorized" })),
    });
    await expect(
      establishConnection(deps, {
        endpoint: ENDPOINT,
        authEnabled: true,
        inputs: resolveFakeInputs(deps, { noInput: true, project: "my-app" }),
      })
    ).rejects.toThrow(SetupFatalError);
  });
});

describe("establishConnection flag-supplied project names", () => {
  it("rejects URL-hostile names from --project in interactive mode", async () => {
    const deps = buildFakeDeps();
    await expect(
      establishConnection(deps, {
        endpoint: ENDPOINT,
        authEnabled: false,
        inputs: resolveFakeInputs(deps, { project: "team/app" }),
      })
    ).rejects.toThrow(HeadlessInputError);
  });
});

describe("establishConnection interactive auth-off", () => {
  it("prompts for a project name with the cwd default", async () => {
    const prompter = scriptedPrompter([undefined]); // accept the default
    const deps = buildFakeDeps({
      context: { cwd: "/home/user/my-app" },
      prompter,
      fetch: fakeFetch(() => jsonResponse(500, {})),
    });
    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: false,
      inputs: resolveFakeInputs(deps),
    });
    expect(connection.projectName).toBe("my-app");
    expect(prompter.transcript).toHaveLength(1);
  });
});

describe("establishConnection interactive auth-on", () => {
  it("reprompts when an API key is rejected with 403", async () => {
    const prompter = scriptedPrompter([undefined, "sk-rejected", "sk-valid"]);
    const deps = buildFakeDeps({
      context: { cwd: "/home/user/my-app" },
      prompter,
      fetch: fakeFetch((_url, request) =>
        request.headers.get("authorization") === "Bearer sk-valid"
          ? jsonResponse(200, { data: [] })
          : jsonResponse(403, { detail: "forbidden" })
      ),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection).toEqual({
      endpoint: ENDPOINT,
      projectName: "my-app",
      apiKey: "sk-valid",
    });
    expect(prompter.transcript).toEqual([
      "Phoenix project name for this app's traces",
      "Phoenix API key",
      "Phoenix API key",
    ]);
  });
});

describe("establishConnection interactive auth-on with OAuth support", () => {
  const projectsOk = (_url: string, request: Request) =>
    request.method === "GET" && request.url.includes("/v1/projects")
      ? jsonResponse(200, { data: [] })
      : undefined;

  it("logs in, mints an API key, and revokes the session", async () => {
    let revoked = false;
    let createRequest: Request | undefined;
    const prompter = scriptedPrompter([undefined, "login"]);
    const deps = buildFakeDeps({
      context: { cwd: "/home/user/my-app" },
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async ({ onAuthorizationUrl }) => {
          onAuthorizationUrl("http://localhost:6006/oauth2/authorize?x=1");
          return {
            status: "success",
            accessToken: "at-123",
            revoke: async () => {
              revoked = true;
            },
          };
        },
      },
      fetch: fakeFetch(projectsOk, (_url, request) => {
        if (
          request.method === "POST" &&
          request.url.includes("/v1/user/api_keys")
        ) {
          createRequest = request;
          return jsonResponse(201, {
            data: { id: "abc", name: "px-setup", key: "sk-minted" },
          });
        }
        return undefined;
      }),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection).toEqual({
      endpoint: ENDPOINT,
      projectName: "my-app",
      apiKey: "sk-minted",
    });
    expect(revoked).toBe(true);
    expect(createRequest?.headers.get("authorization")).toBe("Bearer at-123");
    // Never asked for a pasted key.
    expect(prompter.transcript).toEqual([
      "Phoenix project name for this app's traces",
      "How do you want to connect to Phoenix?",
    ]);
  });

  it("falls back to the paste prompt when the login fails", async () => {
    const prompter = scriptedPrompter([undefined, "login", "sk-pasted"]);
    const deps = buildFakeDeps({
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async () => ({ status: "error", detail: "timed out" }),
      },
      fetch: fakeFetch(projectsOk),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection.apiKey).toBe("sk-pasted");
    expect(
      prompter.output.some((line) => line.includes("didn't complete"))
    ).toBe(true);
  });

  it("narrates a browser that would not open, through the prompter", async () => {
    // A launch failure must be explained: the URL is on screen and Ctrl-C is
    // the way out, but neither is discoverable if the failure is silent.
    const prompter = scriptedPrompter([undefined, "login", "sk-pasted"]);
    const deps = buildFakeDeps({
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async ({ onBrowserOpenFailed }) => {
          onBrowserOpenFailed("spawn xdg-open ENOENT");
          return { status: "cancelled" };
        },
      },
      fetch: fakeFetch(projectsOk),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection.apiKey).toBe("sk-pasted");
    expect(
      prompter.output.some(
        (line) =>
          line.includes("Couldn't open a browser") && line.includes("ENOENT")
      )
    ).toBe(true);
  });

  it("falls back to the paste prompt when the user interrupts the login", async () => {
    // Ctrl-C while the browser wait is on screen must keep the answers already
    // given, not unwind setup: the prompter hands the login an aborted signal.
    const prompter = scriptedPrompter([undefined, "login", "sk-pasted"], {
      interruptWaits: true,
    });
    const deps = buildFakeDeps({
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async ({ signal }) =>
          signal?.aborted
            ? { status: "cancelled" }
            : { status: "error", detail: "the wait was not interruptible" },
      },
      fetch: fakeFetch(projectsOk),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection.apiKey).toBe("sk-pasted");
    expect(connection.projectName).toBe(defaultProjectName(deps.context.cwd));
    // The cancelled copy, not the failure copy: reaching the paste prompt is
    // not enough — it must be the interrupt that sent us there.
    expect(prompter.output).toContain(COPY.CREDENTIALS.loginCancelled);
  });

  it("falls back to the paste prompt when key creation fails", async () => {
    let revoked = false;
    const prompter = scriptedPrompter([undefined, "login", "sk-pasted"]);
    const deps = buildFakeDeps({
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async () => ({
          status: "success",
          accessToken: "at-123",
          revoke: async () => {
            revoked = true;
          },
        }),
      },
      fetch: fakeFetch(projectsOk, (_url, request) =>
        request.method === "POST" && request.url.includes("/v1/user/api_keys")
          ? jsonResponse(403, { detail: "forbidden" })
          : undefined
      ),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });

    expect(connection.apiKey).toBe("sk-pasted");
    expect(revoked).toBe(true);
  });

  it("respects choosing the paste lane over the login", async () => {
    const prompter = scriptedPrompter([undefined, "paste", "sk-pasted"]);
    const deps = buildFakeDeps({
      prompter,
      oauthLogin: {
        isSupported: async () => true,
        login: async () => {
          throw new Error("login must not run when paste is chosen");
        },
      },
      fetch: fakeFetch(projectsOk),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });
    expect(connection.apiKey).toBe("sk-pasted");
  });

  it("skips the method prompt when the server has no OAuth support", async () => {
    const prompter = scriptedPrompter([undefined, "sk-pasted"]);
    const deps = buildFakeDeps({
      prompter,
      fetch: fakeFetch(projectsOk),
    });

    const connection = await establishConnection(deps, {
      endpoint: ENDPOINT,
      authEnabled: true,
      inputs: resolveFakeInputs(deps),
    });
    expect(connection.apiKey).toBe("sk-pasted");
    expect(prompter.transcript).toEqual([
      "Phoenix project name for this app's traces",
      "Phoenix API key",
    ]);
  });
});
