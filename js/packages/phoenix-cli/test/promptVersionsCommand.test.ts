import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../src/cli";
import {
  formatPromptVersionsOutput,
  type PromptVersion,
} from "../src/commands/formatPromptVersions";
import { createPromptCommand } from "../src/commands/prompt";
import { createPromptVersionsCommand } from "../src/commands/promptVersions";
import * as config from "../src/config";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();
const PROMPT_VERSION: componentsV1["schemas"]["PromptVersion"] = {
  id: "pv-003",
  description: "Improved greeting",
  model_provider: "OPENAI",
  model_name: "gpt-4o",
  created_at: "2026-10-14T10:00:00Z",
  template: { type: "string", template: "Hello {{name}}" },
  template_type: "STR",
  template_format: "MUSTACHE",
  invocation_parameters: { type: "openai", openai: {} },
};
const OLDER_VERSION = { ...PROMPT_VERSION, id: "pv-002" };
const OLDEST_VERSION = { ...PROMPT_VERSION, id: "pv-001" };
const { created_at: _createdAt, ...LEGACY_VERSION } = PROMPT_VERSION;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prompt-versions list", () => {
  it.each(["greeting", "UHJvbXB0OjE="])(
    "passes identifier %s to the API and prints raw JSON",
    async (promptIdentifier) => {
      const identifiers: string[] = [];
      mock.server.use(
        http.get(
          "/v1/prompts/{prompt_identifier}/versions",
          ({ params, response }) => {
            identifiers.push(params.prompt_identifier);
            return response(200).json({
              data: [PROMPT_VERSION],
              next_cursor: null,
            });
          }
        )
      );
      const io = captureCliOutput();
      await createPromptVersionsCommand().parseAsync(
        ["list", promptIdentifier, "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      );
      expect(identifiers).toEqual([promptIdentifier]);
      expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([PROMPT_VERSION]));
      expect(io.stderr).not.toHaveBeenCalled();
    }
  );

  it("follows all cursors with a default page size of 100", async () => {
    const queries: { cursor: string | null; limit: string | null }[] = [];
    mock.server.use(
      http.get(
        "/v1/prompts/{prompt_identifier}/versions",
        ({ request, response }) => {
          const query = new URL(request.url).searchParams;
          queries.push({
            cursor: query.get("cursor"),
            limit: query.get("limit"),
          });
          return response(200).json(
            query.has("cursor")
              ? { data: [OLDER_VERSION], next_cursor: null }
              : { data: [PROMPT_VERSION], next_cursor: "next-page" }
          );
        }
      )
    );
    const io = captureCliOutput();
    await createPromptVersionsCommand().parseAsync(
      ["list", "greeting", "--format", "json", ...BASE_ARGS],
      { from: "user" }
    );
    expect(queries).toEqual([
      { cursor: null, limit: "100" },
      { cursor: "next-page", limit: "100" },
    ]);
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify([PROMPT_VERSION, OLDER_VERSION], null, 2)
    );
  });

  it("requests only the remaining limit and stops before the next page", async () => {
    const limits: string[] = [];
    mock.server.use(
      http.get(
        "/v1/prompts/{prompt_identifier}/versions",
        ({ request, response }) => {
          limits.push(new URL(request.url).searchParams.get("limit")!);
          return response(200).json(
            limits.length === 1
              ? { data: [PROMPT_VERSION], next_cursor: "second-page" }
              : { data: [OLDER_VERSION], next_cursor: "third-page" }
          );
        }
      )
    );
    const io = captureCliOutput();
    await createPromptVersionsCommand().parseAsync(
      ["list", "greeting", "--limit", "2", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(limits).toEqual(["2", "1"]);
    expect(JSON.parse(String(io.stdout.mock.calls[0]?.[0]))).toEqual([
      PROMPT_VERSION,
      OLDER_VERSION,
    ]);
  });

  it("does not exceed the limit if a server returns an oversized page", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/versions", ({ response }) =>
        response(200).json({
          data: [PROMPT_VERSION, OLDER_VERSION, OLDEST_VERSION],
          next_cursor: "next-page",
        })
      )
    );
    const io = captureCliOutput();
    await createPromptVersionsCommand().parseAsync(
      ["list", "greeting", "--limit", "1", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([PROMPT_VERSION]));
  });

  it.each(["pretty", "json", "raw"] as const)(
    "supports an older server without created_at in %s output",
    async (format) => {
      mock.server.use(
        http.get("/v1/prompts/{prompt_identifier}/versions", ({ response }) =>
          response.untyped(
            HttpResponse.json({ data: [LEGACY_VERSION], next_cursor: null })
          )
        )
      );
      const io = captureCliOutput();
      await createPromptVersionsCommand().parseAsync(
        ["list", "greeting", "--format", format, ...BASE_ARGS],
        { from: "user" }
      );
      expect(io.stdout).toHaveBeenCalledWith(
        formatPromptVersionsOutput({ promptVersions: [LEGACY_VERSION], format })
      );
      expect(String(io.stdout.mock.calls[0]?.[0])).not.toContain("undefined");
    }
  );

  it("prints an empty result without treating it as an error", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/versions", ({ response }) =>
        response(200).json({ data: [], next_cursor: null })
      )
    );
    const io = captureCliOutput();
    await createPromptVersionsCommand().parseAsync(
      ["list", "greeting", ...BASE_ARGS],
      { from: "user" }
    );
    expect(io.stdout).toHaveBeenCalledWith("No prompt versions found");
  });

  it.each([404, 500])("exits FAILURE on HTTP %i", async (status) => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/versions", ({ response }) =>
        response.untyped(HttpResponse.json({ error: "Failed" }, { status }))
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();
    await expect(
      createPromptVersionsCommand().parseAsync(
        ["list", "missing", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stdout).not.toHaveBeenCalled();
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching prompt versions")
    );
  });

  it("exits NETWORK_ERROR on a connection failure", async () => {
    mock.server.use(
      http.get("/v1/prompts/{prompt_identifier}/versions", () =>
        HttpResponse.error()
      )
    );
    captureCliOutput();
    mockProcessExit();
    await expect(
      createPromptVersionsCommand().parseAsync(
        ["list", "greeting", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);
  });

  it.each(["0", "-1", "1.5", "abc", "2oops"])(
    "rejects invalid limit %s without making a request",
    async (limit) => {
      const io = captureCliOutput();
      mockProcessExit();
      await expect(
        createPromptVersionsCommand().parseAsync(
          ["list", "greeting", "--limit", limit, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringContaining("--limit must be a positive integer")
      );
    }
  );

  it("exits INVALID_ARGUMENT for missing configuration", async () => {
    vi.spyOn(config, "resolveConfig").mockReturnValue({});
    const io = captureCliOutput();
    mockProcessExit();
    await expect(
      createPromptVersionsCommand().parseAsync(["list", "greeting"], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("--endpoint")
    );
  });

  it("works through the registered command against generated handlers alone", async () => {
    const io = captureCliOutput();
    await createProgram().parseAsync(
      [
        "prompt-versions",
        "list",
        "greeting",
        "--limit",
        "1",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );
    const versions = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(versions).toHaveLength(1);
    expect(typeof versions[0].id).toBe("string");
    expect(typeof versions[0].created_at).toBe("string");
  });

  it("includes examples and the prompt get discovery pointer in help", () => {
    const command = createPromptVersionsCommand();
    let help = "";
    command.commands[0].configureOutput({
      writeOut: (text) => {
        help += text;
      },
    });
    command.commands[0].outputHelp();
    expect(help).toContain("px prompt-versions list my-prompt");
    expect(help).toContain("--format raw --no-progress");
    expect(
      createPromptCommand()
        .commands.find((subcommand) => subcommand.name() === "get")
        ?.helpInformation()
    ).toContain("px prompt-versions list");
  });
});

describe("formatPromptVersionsOutput", () => {
  it("shows IDs, descriptions, provider, model, and creation timestamp", () => {
    const output = formatPromptVersionsOutput({
      promptVersions: [PROMPT_VERSION],
    });
    for (const value of [
      "pv-003",
      "Improved greeting",
      "OPENAI",
      "gpt-4o",
      PROMPT_VERSION.created_at,
    ]) {
      expect(output).toContain(value);
    }
    expect(output).not.toContain("template");
  });

  it.each(["json", "raw"] as const)(
    "preserves full versions in %s",
    (format) => {
      const output = formatPromptVersionsOutput({
        promptVersions: [PROMPT_VERSION],
        format,
      });
      expect(output).toBe(
        JSON.stringify(
          [PROMPT_VERSION],
          null,
          format === "json" ? 2 : undefined
        )
      );
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "formats empty %s output",
    (format) => {
      expect(formatPromptVersionsOutput({ promptVersions: [], format })).toBe(
        format === "pretty" ? "No prompt versions found" : "[]"
      );
    }
  );

  it("leaves the date cell blank for legacy versions", () => {
    const legacyVersions: PromptVersion[] = [LEGACY_VERSION];
    const output = formatPromptVersionsOutput({
      promptVersions: legacyVersions,
    });
    expect(output.split("\n")[3]).toMatch(/│\s+│$/);
    expect(output).not.toContain("Invalid Date");
    expect(output).not.toContain("undefined");
  });
});
