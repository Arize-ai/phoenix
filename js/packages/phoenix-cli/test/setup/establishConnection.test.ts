import { describe, expect, it } from "vitest";

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
    const prompter = scriptedPrompter(["sk-rejected", undefined, "sk-valid"]);
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
      "Phoenix API key",
      "Phoenix project name for this app's traces",
      "Phoenix API key",
    ]);
  });
});
