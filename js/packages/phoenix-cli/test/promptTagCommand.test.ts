import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../src/cli";
import { formatPromptVersionTagOutput } from "../src/commands/formatPromptVersionTag";
import { createPromptCommand } from "../src/commands/prompt";
import * as config from "../src/config";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const TAG_ROUTE = "/v1/prompt_versions/{prompt_version_id}/tags";
const USAGE =
  "px prompt tag <prompt-version-id> --tag <name> [--description <text>]";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Report a Phoenix server version. upsertPromptVersionTag checks it before
 * posting; the endpoint returns plain text, which the typed helper cannot
 * express.
 */
function useServerVersion(version = "14.0.0") {
  const captured = { count: 0 };
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) => {
      captured.count += 1;
      return response.untyped(new Response(version, { status: 200 }));
    })
  );
  return captured;
}

interface TagRecord {
  promptVersionId: string;
  description: string | null;
}

/**
 * A minimal stand-in for the server's tag table on a single prompt: tag names
 * are unique, and a POST overwrites the version and description of an
 * existing name (the `ON CONFLICT (name, prompt_id) DO UPDATE` upsert).
 * Records every request body so tests can assert what the CLI sent.
 */
function useTagStore() {
  const tags = new Map<string, TagRecord>();
  const requests: { promptVersionId: string; body: Record<string, unknown> }[] =
    [];
  mock.server.use(
    http.post(TAG_ROUTE, async ({ params, request, response }) => {
      const body = (await request.json()) as Record<string, unknown>;
      requests.push({ promptVersionId: params.prompt_version_id, body });
      tags.set(String(body.name), {
        promptVersionId: params.prompt_version_id,
        description:
          typeof body.description === "string" ? body.description : null,
      });
      return response(204).empty();
    })
  );
  return { tags, requests };
}

/** Count tag POSTs and version probes to prove a command never hit the network. */
function useNetworkCounter() {
  const captured = { count: 0 };
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) => {
      captured.count += 1;
      return response.untyped(new Response("14.0.0", { status: 200 }));
    }),
    http.post(TAG_ROUTE, ({ response }) => {
      captured.count += 1;
      return response(204).empty();
    })
  );
  return captured;
}

function runTag(args: string[]) {
  return createPromptCommand().parseAsync(["tag", ...args, ...BASE_ARGS], {
    from: "user",
  });
}

function stdoutText(io: ReturnType<typeof captureCliOutput>): string {
  return String(io.stdout.mock.calls[0]?.[0]);
}

function stderrJson(io: ReturnType<typeof captureCliOutput>): unknown {
  return JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
}

describe("prompt tag", () => {
  it("creates a new tag on the version and prints what was applied", async () => {
    const versionProbe = useServerVersion();
    const store = useTagStore();
    const io = captureCliOutput();

    await runTag([
      "pv-1",
      "--tag",
      "production",
      "--description",
      "Current release",
      "--format",
      "raw",
    ]);

    expect(versionProbe.count).toBe(1);
    expect(store.requests).toEqual([
      {
        promptVersionId: "pv-1",
        body: { name: "production", description: "Current release" },
      },
    ]);
    expect(store.tags.get("production")).toEqual({
      promptVersionId: "pv-1",
      description: "Current release",
    });
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdoutText(io))).toEqual({
      prompt_version_id: "pv-1",
      name: "production",
      description: "Current release",
    });
    expect(io.stderr).not.toHaveBeenCalled();
  });

  it("moves an existing tag by posting the same name to another version", async () => {
    useServerVersion();
    const store = useTagStore();
    const io = captureCliOutput();

    await runTag(["pv-1", "--tag", "production", "--format", "raw"]);
    await runTag(["pv-2", "--tag", "production", "--format", "raw"]);

    expect(store.requests.map((request) => request.promptVersionId)).toEqual([
      "pv-1",
      "pv-2",
    ]);
    // One tag remains and it now points at the second version.
    expect([...store.tags.keys()]).toEqual(["production"]);
    expect(store.tags.get("production")?.promptVersionId).toBe("pv-2");
    // Output for both calls has the same shape: 204 gives no way to tell a
    // create from a move, so the CLI does not claim either.
    expect(JSON.parse(String(io.stdout.mock.calls[1]?.[0]))).toEqual({
      prompt_version_id: "pv-2",
      name: "production",
      description: null,
    });
  });

  it("omits description from the request when --description is not passed, clearing an old one", async () => {
    useServerVersion();
    const store = useTagStore();
    const io = captureCliOutput();

    await runTag([
      "pv-1",
      "--tag",
      "production",
      "--description",
      "old",
      "--format",
      "raw",
    ]);
    await runTag(["pv-1", "--tag", "production", "--format", "raw"]);

    expect(store.requests[1]?.body).toEqual({ name: "production" });
    expect("description" in (store.requests[1]?.body ?? {})).toBe(false);
    expect(store.tags.get("production")?.description).toBeNull();
    expect(JSON.parse(String(io.stdout.mock.calls[1]?.[0])).description).toBe(
      null
    );
  });

  it("prints a readable summary in pretty output", async () => {
    useServerVersion();
    useTagStore();
    const io = captureCliOutput();

    await runTag(["pv-1", "--tag", "staging"]);

    expect(stdoutText(io)).toBe(
      [
        "Tag applied",
        "  Tag: staging",
        "  Prompt version: pv-1",
        "  Description: (none)",
      ].join("\n")
    );
  });

  it("prints indented JSON in json output", async () => {
    useServerVersion();
    useTagStore();
    const io = captureCliOutput();

    await runTag([
      "pv-1",
      "--tag",
      "staging",
      "--description",
      "QA",
      "--format",
      "json",
    ]);

    const expected = {
      prompt_version_id: "pv-1",
      name: "staging",
      description: "QA",
    };
    expect(stdoutText(io)).toBe(JSON.stringify(expected, null, 2));
  });

  describe("input validation", () => {
    it("exits INVALID_ARGUMENT without any request when --tag is missing", async () => {
      const network = useNetworkCounter();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(runTag(["pv-1"])).rejects.toThrow(
        `process.exit:${ExitCode.INVALID_ARGUMENT}`
      );

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(network.count).toBe(0);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
        "Missing required flag --tag."
      );
      expect(String(io.stderr.mock.calls[0]?.[0])).toContain(USAGE);
    });

    it.each(["Production", "has space", "-leading", "trailing_", ""])(
      "rejects tag name %j before any request",
      async (tagName) => {
        const network = useNetworkCounter();
        const io = captureCliOutput();
        mockProcessExit();

        await expect(
          runTag(["pv-1", "--tag", tagName, "--format", "raw"])
        ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

        expect(network.count).toBe(0);
        expect(stderrJson(io)).toEqual({
          error: expect.stringContaining("Invalid value for --tag"),
          code: "INVALID_ARGUMENT",
        });
      }
    );

    it.each(["v2", "prod-eu_1", "a"])(
      "accepts valid tag name %j",
      async (tagName) => {
        useServerVersion();
        const store = useTagStore();
        captureCliOutput();

        await runTag(["pv-1", "--tag", tagName, "--format", "raw"]);

        expect(store.requests[0]?.body.name).toBe(tagName);
      }
    );

    it("rejects a blank prompt version ID before any request", async () => {
      const network = useNetworkCounter();
      const io = captureCliOutput();
      mockProcessExit();

      await expect(
        runTag(["  ", "--tag", "production", "--format", "raw"])
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(network.count).toBe(0);
      expect(stderrJson(io)).toEqual({
        error: expect.stringContaining("<prompt-version-id>"),
        code: "INVALID_ARGUMENT",
      });
    });

    it("rejects an unknown --format before any request", async () => {
      const network = useNetworkCounter();
      const command = createPromptCommand();
      const tagCommand = command.commands.find(
        (subcommand) => subcommand.name() === "tag"
      );
      let errorOutput = "";
      tagCommand?.exitOverride().configureOutput({
        writeErr: (text) => {
          errorOutput += text;
        },
      });

      await expect(
        command.parseAsync(
          ["tag", "pv-1", "--tag", "production", "--format", "text"],
          { from: "user" }
        )
      ).rejects.toThrow();

      expect(errorOutput).toContain("Allowed choices are pretty, json, raw");
      expect(network.count).toBe(0);
    });

    it("exits INVALID_ARGUMENT when no endpoint is configured", async () => {
      const network = useNetworkCounter();
      vi.spyOn(config, "resolveConfig").mockReturnValue({});
      const io = captureCliOutput();
      mockProcessExit();

      await expect(
        createPromptCommand().parseAsync(
          ["tag", "pv-1", "--tag", "production"],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(network.count).toBe(0);
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringContaining("--endpoint")
      );
    });
  });

  describe("server and network errors", () => {
    it.each([
      [401, ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED", "px auth status"],
      [403, ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED", "px auth status"],
      [
        404,
        ExitCode.FAILURE,
        "FAILURE",
        "px prompt-versions list <prompt-identifier>",
      ],
      [422, ExitCode.INVALID_ARGUMENT, "INVALID_ARGUMENT", USAGE],
    ] as const)(
      "maps HTTP %i to exit %i with a structured %s error",
      async (status, exitCode, codeName, hint) => {
        useServerVersion();
        mock.server.use(
          http.post(TAG_ROUTE, ({ response }) =>
            response.untyped(new Response("nope", { status }))
          )
        );
        const io = captureCliOutput();
        const exitSpy = mockProcessExit();

        await expect(
          runTag(["pv-1", "--tag", "production", "--format", "raw"])
        ).rejects.toThrow(`process.exit:${exitCode}`);

        expect(exitSpy).toHaveBeenCalledWith(exitCode);
        expect(io.stdout).not.toHaveBeenCalled();
        expect(io.stderr).toHaveBeenCalledTimes(1);
        expect(stderrJson(io)).toEqual({
          error: expect.stringContaining(String(status)),
          code: codeName,
          hint,
        });
      }
    );

    it("writes a plain message with the hint in pretty output", async () => {
      useServerVersion();
      mock.server.use(
        http.post(TAG_ROUTE, ({ response }) =>
          response.untyped(new Response("not found", { status: 404 }))
        )
      );
      const io = captureCliOutput();
      mockProcessExit();

      await expect(runTag(["missing", "--tag", "production"])).rejects.toThrow(
        `process.exit:${ExitCode.FAILURE}`
      );

      const message = String(io.stderr.mock.calls[0]?.[0]);
      expect(message).toMatch(/^Error tagging prompt version: /);
      expect(message).toContain(
        "Hint: px prompt-versions list <prompt-identifier>"
      );
    });

    it("exits NETWORK_ERROR when the tag request cannot connect", async () => {
      useServerVersion();
      mock.server.use(http.post(TAG_ROUTE, () => HttpResponse.error()));
      const io = captureCliOutput();
      mockProcessExit();

      await expect(
        runTag(["pv-1", "--tag", "production", "--format", "raw"])
      ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

      expect(io.stdout).not.toHaveBeenCalled();
      expect(stderrJson(io)).toEqual({
        error: expect.stringContaining("Error tagging prompt version"),
        code: "NETWORK_ERROR",
      });
    });

    it("fails without posting when the server is too old for tag upserts", async () => {
      useServerVersion("8.21.0");
      const network = { posts: 0 };
      mock.server.use(
        http.post(TAG_ROUTE, ({ response }) => {
          network.posts += 1;
          return response(204).empty();
        })
      );
      const io = captureCliOutput();
      mockProcessExit();

      await expect(
        runTag(["pv-1", "--tag", "production", "--format", "raw"])
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

      expect(network.posts).toBe(0);
      expect(stderrJson(io)).toEqual({
        error: expect.stringContaining("requires Phoenix server >= 8.22.0"),
        code: "FAILURE",
      });
    });
  });

  it("tags a version through the registered command with minimal pinning", async () => {
    // Everything else is left to the generated handlers, but two responses
    // must be pinned: the version probe is plain text the generator cannot
    // produce as a semantic version, and @mswjs/source only generates 200 or
    // `default` responses, so this 204-only route would otherwise answer 501.
    useServerVersion();
    mock.server.use(
      http.post(TAG_ROUTE, ({ response }) => response(204).empty())
    );
    const io = captureCliOutput();

    await createProgram().parseAsync(
      [
        "prompt",
        "tag",
        "pv-1",
        "--tag",
        "production",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(JSON.parse(stdoutText(io))).toEqual({
      prompt_version_id: "pv-1",
      name: "production",
      description: null,
    });
  });

  it("is registered under prompt with examples and the clearing note in help", () => {
    const promptCommand = createProgram().commands.find(
      (command) => command.name() === "prompt"
    );
    const tagCommand = promptCommand?.commands.find(
      (command) => command.name() === "tag"
    );
    expect(tagCommand).toBeDefined();

    let help = "";
    tagCommand?.configureOutput({
      writeOut: (text) => {
        help += text;
      },
    });
    tagCommand?.outputHelp();

    expect(help).toContain("prompt tag [options] <prompt-version-id>");
    expect(help).toContain("--tag <name>");
    expect(help).toContain("--description <text>");
    expect(help).toContain(
      "px prompt tag UHJvbXB0VmVyc2lvbjox --tag production"
    );
    expect(help).toContain(
      "omitting\n--description clears an existing description"
    );
  });
});

describe("formatPromptVersionTagOutput", () => {
  const tag = {
    prompt_version_id: "pv-1",
    name: "production",
    description: "Current release",
  };

  it("renders raw output as single-line JSON", () => {
    const output = formatPromptVersionTagOutput({ tag, format: "raw" });
    expect(output).not.toContain("\n");
    expect(JSON.parse(output)).toEqual(tag);
  });

  it("defaults to pretty output and shows the description", () => {
    expect(formatPromptVersionTagOutput({ tag })).toContain(
      "Description: Current release"
    );
  });
});
