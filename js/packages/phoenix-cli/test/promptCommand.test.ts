import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPromptCommand } from "../src/commands/prompt";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const PROMPT: componentsV1["schemas"]["Prompt"] = {
  id: "prompt-001",
  name: "greeting",
  description: "says hello",
};

const PROMPT_VERSION: componentsV1["schemas"]["PromptVersion"] = {
  id: "pv-001",
  description: "first version",
  model_provider: "OPENAI",
  model_name: "gpt-4o",
  template: { type: "string", template: "Hello {{name}}" },
  template_type: "STR",
  template_format: "MUSTACHE",
  invocation_parameters: { type: "openai", openai: { temperature: 0.5 } },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prompt list", () => {
  it("propagates --limit to the query and prints prompts as raw JSON", async () => {
    const captured: { limit?: string | null; count: number } = { count: 0 };
    mock.server.use(
      http.get("/v1/prompts", ({ request, response }) => {
        captured.count += 1;
        captured.limit = new URL(request.url).searchParams.get("limit");
        return response(200).json({ data: [PROMPT], next_cursor: null });
      })
    );
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      ["list", "--limit", "25", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.limit).toBe("25");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([PROMPT]);
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(http.get("/v1/prompts", () => HttpResponse.error()));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handler: the schema-generated mock answers everything. The
    // generated pages always carry a non-null next_cursor, so --limit 1 is
    // required to stop the CLI's pagination loop.
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      ["list", "--limit", "1", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(typeof parsed[0].id).toBe("string");
    expect(typeof parsed[0].name).toBe("string");
  });
});

describe("prompt get", () => {
  it("fetches the latest version by identifier and prints it as raw JSON", async () => {
    const captured: { identifier?: string; count: number } = { count: 0 };
    mock.server.use(
      http.get(
        "/v1/prompts/{prompt_identifier}/latest",
        ({ params, response }) => {
          captured.count += 1;
          captured.identifier = params.prompt_identifier;
          return response(200).json({ data: PROMPT_VERSION });
        }
      )
    );
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      ["get", "greeting", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.identifier).toBe("greeting");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(PROMPT_VERSION);
  });

  it("routes --tag to the tag endpoint with both path params", async () => {
    const captured: { identifier?: string; tag?: string; count: number } = {
      count: 0,
    };
    mock.server.use(
      http.get(
        "/v1/prompts/{prompt_identifier}/tags/{tag_name}",
        ({ params, response }) => {
          captured.count += 1;
          captured.identifier = params.prompt_identifier;
          captured.tag = params.tag_name;
          return response(200).json({ data: PROMPT_VERSION });
        }
      )
    );
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "get",
        "greeting",
        "--tag",
        "production",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.identifier).toBe("greeting");
    expect(captured.tag).toBe("production");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(PROMPT_VERSION);
  });

  it("exits FAILURE when the prompt is not found", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["get", "missing", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching prompt")
    );
  });
});
