import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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

describe("prompt set", () => {
  it("POSTs a new prompt from --template and --model when latest is missing", async () => {
    const captured: { body?: Record<string, unknown>; count: number } = {
      count: 0,
    };
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      ),
      http.post("/v1/prompts", async ({ request, response }) => {
        captured.count += 1;
        captured.body = (await request.clone().json()) as Record<
          string,
          unknown
        >;
        return response(200).json({ data: PROMPT_VERSION });
      })
    );
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "set",
        "greeting",
        "--template",
        "Hello {{name}}",
        "--model",
        "gpt-4o",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.body).toEqual({
      prompt: { name: "greeting" },
      version: {
        model_provider: "OPENAI",
        model_name: "gpt-4o",
        template: {
          type: "chat",
          messages: [{ role: "user", content: "Hello {{name}}" }],
        },
        template_type: "CHAT",
        template_format: "MUSTACHE",
        invocation_parameters: { type: "openai", openai: {} },
      },
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(PROMPT_VERSION);
  });

  it("inherits model from the latest version when only --template is passed", async () => {
    const captured: { body?: Record<string, unknown>; count: number } = {
      count: 0,
    };
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
        response(200).json({ data: PROMPT_VERSION })
      ),
      http.post("/v1/prompts", async ({ request, response }) => {
        captured.count += 1;
        captured.body = (await request.clone().json()) as Record<
          string,
          unknown
        >;
        return response(200).json({ data: PROMPT_VERSION });
      })
    );
    captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "set",
        "greeting",
        "--template",
        "Hi {{name}}",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    const version = captured.body?.version as {
      model_name?: string;
      template?: { messages?: Array<{ content?: string }> };
    };
    expect(version.model_name).toBe("gpt-4o");
    expect(version.template?.messages?.[0]?.content).toBe("Hi {{name}}");
  });

  it("reads a PromptVersion JSON file and tags the new version", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "px-prompt-set-"));
    const filePath = path.join(tmpDir, "prompt.json");
    fs.writeFileSync(filePath, JSON.stringify(PROMPT_VERSION));
    const captured: {
      body?: Record<string, unknown>;
      tagName?: string;
      tagCount: number;
    } = { tagCount: 0 };
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      ),
      http.post("/v1/prompts", async ({ request, response }) => {
        captured.body = (await request.clone().json()) as Record<
          string,
          unknown
        >;
        return response(200).json({ data: PROMPT_VERSION });
      }),
      http.post(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        async ({ request, response }) => {
          captured.tagCount += 1;
          const tagBody = (await request.clone().json()) as { name?: string };
          captured.tagName = tagBody.name;
          return response(204).empty();
        }
      )
    );
    const io = captureCliOutput();

    try {
      await createPromptCommand().parseAsync(
        [
          "set",
          "greeting",
          "--file",
          filePath,
          "--tag",
          "production",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    expect(captured.tagCount).toBe(1);
    expect(captured.tagName).toBe("production");
    const version = captured.body?.version as { model_name?: string };
    expect(version.model_name).toBe("gpt-4o");
    expect(JSON.parse(String(io.stdout.mock.calls[0]?.[0]))).toEqual(
      PROMPT_VERSION
    );
  });

  it("exits INVALID_ARGUMENT when creating without --model", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        [
          "set",
          "greeting",
          "--template",
          "Hello",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required flag --model")
    );
  });

  it("exits INVALID_ARGUMENT when no template or version field is given", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["set", "greeting", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Provide a template")
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/latest", () =>
        HttpResponse.error()
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        [
          "set",
          "greeting",
          "--template",
          "Hello",
          "--model",
          "gpt-4o",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "set",
        "greeting",
        "--template",
        "Hello {{name}}",
        "--model",
        "gpt-4o",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(typeof parsed.id).toBe("string");
    expect(parsed.template).toBeDefined();
  });
});
