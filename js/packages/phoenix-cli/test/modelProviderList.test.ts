import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatModelProvidersOutput } from "../src/commands/formatModelProviders";
import { createModelProviderCommand } from "../src/commands/modelProvider";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const MODEL_PROVIDERS = [
  { provider: "OPENAI", name: "OpenAI" },
  { provider: "ANTHROPIC", name: "Anthropic" },
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

async function runList(format: string) {
  const io = captureCliOutput();
  await createModelProviderCommand().parseAsync(
    ["list", "--format", format, ...BASE_ARGS],
    { from: "user" }
  );
  return String(io.stdout.mock.calls[0]?.[0]);
}

describe("model-provider list", () => {
  it("prints the server allow-list as raw JSON", async () => {
    let requestCount = 0;
    mock.server.use(
      http.get("/v1/model_providers", ({ response }) => {
        requestCount += 1;
        return response(200).json({ data: [...MODEL_PROVIDERS] });
      })
    );

    const output = await runList("raw");

    expect(requestCount).toBe(1);
    expect(output).toBe(JSON.stringify(MODEL_PROVIDERS));
  });

  it("prints indented JSON", async () => {
    mock.server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response(200).json({ data: [...MODEL_PROVIDERS] })
      )
    );

    const output = await runList("json");

    expect(output).toBe(JSON.stringify(MODEL_PROVIDERS, null, 2));
  });

  it("prints a table with the provider key and display name", async () => {
    mock.server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response(200).json({ data: [...MODEL_PROVIDERS] })
      )
    );

    const output = await runList("pretty");

    expect(output).toMatch(/provider\s+│\s+name/);
    expect(output).toMatch(/OPENAI\s+│\s+OpenAI/);
    expect(output).toMatch(/ANTHROPIC\s+│\s+Anthropic/);
  });

  it.each([
    ["raw", "[]"],
    ["json", "[]"],
    ["pretty", "No model providers found"],
  ])("handles an empty allow-list in %s mode", async (format, expected) => {
    mock.server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response(200).json({ data: [] })
      )
    );

    const output = await runList(format);

    expect(output).toBe(expected);
  });

  it("exits FAILURE with an error message on a server error", async () => {
    mock.server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 500 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createModelProviderCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching model providers")
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.get("/v1/model_providers", () => HttpResponse.error())
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createModelProviderCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handler: the schema-generated mock answers the request.
    const output = await runList("raw");

    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(typeof parsed[0].provider).toBe("string");
    expect(typeof parsed[0].name).toBe("string");
  });
});

describe("formatModelProvidersOutput", () => {
  it("defaults to the pretty table", () => {
    expect(
      formatModelProvidersOutput({ modelProviders: [...MODEL_PROVIDERS] })
    ).toBe(
      formatModelProvidersOutput({
        modelProviders: [...MODEL_PROVIDERS],
        format: "pretty",
      })
    );
  });
});
