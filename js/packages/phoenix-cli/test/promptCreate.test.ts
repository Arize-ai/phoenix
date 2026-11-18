import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PassThrough } from "stream";
import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPromptCommand } from "../src/commands/prompt";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const CREATED_VERSION: componentsV1["schemas"]["PromptVersion"] = {
  id: "pv-new",
  created_at: "2026-11-08T10:00:00Z",
  description: "",
  model_provider: "OPENAI",
  model_name: "gpt-5.6-luna",
  template: {
    type: "chat",
    messages: [{ role: "user", content: "Hello {{name}}" }],
  },
  template_type: "CHAT",
  template_format: "MUSTACHE",
  invocation_parameters: { type: "openai", openai: {} },
};

/**
 * A version as `px prompt get --format json` prints it, including the
 * read-only `id` and `created_at`.
 */
const FETCHED_VERSION: componentsV1["schemas"]["PromptVersion"] = {
  id: "pv-fetched",
  created_at: "2026-11-01T10:00:00Z",
  description: "Answers questions",
  metadata: { owner: "support" },
  model_provider: "ANTHROPIC",
  model_name: "claude-sonnet-5-5",
  template: {
    type: "chat",
    messages: [
      { role: "system", content: "You answer briefly." },
      { role: "user", content: "{{question}}" },
    ],
  },
  template_type: "CHAT",
  template_format: "MUSTACHE",
  invocation_parameters: {
    type: "anthropic",
    anthropic: { max_tokens: 1024, temperature: 0.5 },
  },
  tools: {
    type: "tools",
    tools: [
      {
        type: "function",
        function: { name: "search", parameters: { type: "object" } },
      },
    ],
  },
  response_format: {
    type: "json_schema",
    json_schema: { name: "answer", schema: { type: "object" } },
  },
};

type CreateBody = componentsV1["schemas"]["CreatePromptRequestBody"];

/**
 * Pin `POST /v1/prompts` to return {@link CREATED_VERSION} and record every
 * request body it receives.
 */
function captureCreateRequests(): CreateBody[] {
  const bodies: CreateBody[] = [];
  mock.server.use(
    http.post("/v1/prompts", async ({ request, response }) => {
      bodies.push((await request.json()) as CreateBody);
      return response(200).json({ data: CREATED_VERSION });
    })
  );
  return bodies;
}

let tempDir: string;

/**
 * Replace stdin with a pipe that writes `text` only after a delay, like a
 * slower command upstream in a shell pipeline.
 */
function pipeToStdinLater(text: string): void {
  const stdin = new PassThrough();
  setTimeout(() => stdin.end(text), 20);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as unknown as typeof process.stdin
  );
}

/**
 * Write `contents` to a file in the test's temp directory and return its path.
 */
function writeTempFile({
  fileName,
  contents,
}: {
  fileName: string;
  contents: string;
}): string {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

/**
 * Run `px prompt create` with `args` against the mock server.
 */
async function runCreate(args: string[]): Promise<void> {
  await createPromptCommand().parseAsync(["create", ...args, ...BASE_ARGS], {
    from: "user",
  });
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "px-prompt-create-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("prompt create", () => {
  it("sends --template as a user message with the default model and prints the version", async () => {
    const bodies = captureCreateRequests();
    const io = captureCliOutput();

    await runCreate([
      "--name",
      "greeting",
      "--description",
      "says hello",
      "--template",
      "Hello {{name}}",
      "--format",
      "raw",
    ]);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.prompt).toEqual({
      name: "greeting",
      description: "says hello",
    });
    expect(bodies[0]?.version).toEqual({
      description: "says hello",
      model_provider: "OPENAI",
      model_name: "gpt-5.6-luna",
      template_type: "CHAT",
      template_format: "MUSTACHE",
      template: {
        type: "chat",
        messages: [{ role: "user", content: "Hello {{name}}" }],
      },
      invocation_parameters: { type: "openai", openai: {} },
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(CREATED_VERSION);
  });

  it("reads the template from stdin when --template-file is -", async () => {
    pipeToStdinLater("Piped {{name}}");
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate(["--name", "greeting", "--template-file", "-"]);

    expect(bodies[0]?.version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Piped {{name}}" }],
    });
  });

  it("orders messages as --system, --messages-file, each --message, then --template", async () => {
    const messagesPath = writeTempFile({
      fileName: "messages.json",
      contents: JSON.stringify([
        { role: "user", content: "Example question" },
        { role: "assistant", content: "Example answer" },
      ]),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate([
      "--name",
      "qa",
      "--template",
      "{{question}}",
      "--message",
      "user=Second example",
      "--system",
      "You answer briefly.",
      "--message",
      "assistant=Second answer = short",
      "--messages-file",
      messagesPath,
    ]);

    expect(bodies[0]?.version.template).toEqual({
      type: "chat",
      messages: [
        { role: "system", content: "You answer briefly." },
        { role: "user", content: "Example question" },
        { role: "assistant", content: "Example answer" },
        { role: "user", content: "Second example" },
        { role: "assistant", content: "Second answer = short" },
        { role: "user", content: "{{question}}" },
      ],
    });
  });

  it("posts the output of px prompt get --format json back unchanged, minus id and created_at", async () => {
    const filePath = writeTempFile({
      fileName: "qa.json",
      contents: JSON.stringify(FETCHED_VERSION),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate(["--name", "qa", "--file", filePath]);

    const { id: _id, created_at: _createdAt, ...expected } = FETCHED_VERSION;
    expect(bodies[0]?.version).toEqual(expected);
  });

  it("reads --file from stdin", async () => {
    pipeToStdinLater(JSON.stringify(FETCHED_VERSION));
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate(["--name", "qa", "--file", "-"]);

    expect(bodies[0]?.version.model_name).toBe("claude-sonnet-5-5");
  });

  it("lets flags override the matching fields of --file", async () => {
    const filePath = writeTempFile({
      fileName: "qa.json",
      contents: JSON.stringify(FETCHED_VERSION),
    });
    const responseFormatPath = writeTempFile({
      fileName: "format.json",
      contents: JSON.stringify({
        type: "json_schema",
        json_schema: { name: "short_answer", schema: { type: "string" } },
      }),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate([
      "--name",
      "qa",
      "--file",
      filePath,
      "--template",
      "Answer: {{question}}",
      "--model-name",
      "claude-opus-5-5",
      "--param",
      "temperature=0",
      "--description",
      "Stricter answers",
      "--template-format",
      "f_string",
      "--response-format-file",
      responseFormatPath,
    ]);

    expect(bodies[0]?.version).toMatchObject({
      description: "Stricter answers",
      model_provider: "ANTHROPIC",
      model_name: "claude-opus-5-5",
      template_format: "F_STRING",
      template: {
        type: "chat",
        messages: [{ role: "user", content: "Answer: {{question}}" }],
      },
      invocation_parameters: {
        type: "anthropic",
        anthropic: { max_tokens: 1024, temperature: 0 },
      },
      tools: FETCHED_VERSION.tools,
      response_format: {
        type: "json_schema",
        json_schema: { name: "short_answer", schema: { type: "string" } },
      },
    });
  });

  it("keeps a string template from --file when no message flag is given", async () => {
    const filePath = writeTempFile({
      fileName: "summarize.json",
      contents: JSON.stringify({
        ...FETCHED_VERSION,
        template: { type: "string", template: "Summarize: {text}" },
        template_type: "STR",
        template_format: "F_STRING",
      }),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate(["--name", "summarize", "--file", filePath]);

    expect(bodies[0]?.version).toMatchObject({
      template: { type: "string", template: "Summarize: {text}" },
      template_type: "STR",
      template_format: "F_STRING",
    });
  });

  it("does not reuse the file's model name when --model-provider changes the provider", async () => {
    const filePath = writeTempFile({
      fileName: "qa.json",
      contents: JSON.stringify(FETCHED_VERSION),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate([
      "--name",
      "qa",
      "--file",
      filePath,
      "--model-provider",
      "openai",
    ]);

    expect(bodies[0]?.version).toMatchObject({
      model_provider: "OPENAI",
      model_name: "gpt-5.6-luna",
      invocation_parameters: {
        type: "openai",
        openai: { max_tokens: 1024, temperature: 0.5 },
      },
    });
  });

  it("merges --invocation-parameters and each --param, parsing values as JSON", async () => {
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate([
      "--name",
      "qa",
      "--template",
      "{{question}}",
      "--model-provider",
      "GROQ",
      "--model-name",
      "llama-5",
      "--invocation-parameters",
      '{"temperature": 0.9, "top_p": 0.5}',
      "--param",
      "temperature=0.2",
      "--param",
      'stop=["\\n\\n"]',
      "--param",
      "reasoning_effort=low",
    ]);

    expect(bodies[0]?.version.invocation_parameters).toEqual({
      type: "groq",
      groq: {
        temperature: 0.2,
        top_p: 0.5,
        stop: ["\n\n"],
        reasoning_effort: "low",
      },
    });
  });

  it("wraps a bare --tools-file array and sends --metadata on the prompt", async () => {
    const tools = [
      {
        type: "function",
        function: { name: "search", parameters: { type: "object" } },
      },
    ];
    const toolsPath = writeTempFile({
      fileName: "tools.json",
      contents: JSON.stringify(tools),
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await runCreate([
      "--name",
      "agent",
      "--template",
      "{{task}}",
      "--tools-file",
      toolsPath,
      "--metadata",
      '{"team": "support"}',
    ]);

    expect(bodies[0]?.version.tools).toEqual({ type: "tools", tools });
    expect(bodies[0]?.prompt.metadata).toEqual({ team: "support" });
  });

  describe("--if-not-exists", () => {
    const EXISTING_VERSION: componentsV1["schemas"]["PromptVersion"] = {
      ...CREATED_VERSION,
      id: "pv-existing",
    };

    it("prints the existing latest version without creating a new one", async () => {
      const lookedUp: string[] = [];
      mock.server.use(
        http.get(
          "/v1/prompts/{prompt_identifier}/latest",
          ({ params, response }) => {
            lookedUp.push(params.prompt_identifier);
            return response(200).json({ data: EXISTING_VERSION });
          }
        )
      );
      const bodies = captureCreateRequests();
      const io = captureCliOutput();

      await runCreate([
        "--name",
        "greeting",
        "--template",
        "Hi",
        "--if-not-exists",
        "--format",
        "raw",
      ]);

      expect(lookedUp).toEqual(["greeting"]);
      expect(bodies).toHaveLength(0);
      const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
      expect(parsed).toEqual(EXISTING_VERSION);
    });

    it("creates the prompt when the lookup returns 404", async () => {
      mock.server.use(
        http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
          response.untyped(HttpResponse.json({}, { status: 404 }))
        )
      );
      const bodies = captureCreateRequests();
      const io = captureCliOutput();

      await runCreate([
        "--name",
        "greeting",
        "--template",
        "Hi",
        "--if-not-exists",
        "--format",
        "raw",
      ]);

      expect(bodies).toHaveLength(1);
      const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
      expect(parsed).toEqual(CREATED_VERSION);
    });

    it("exits FAILURE without creating when the lookup fails for another reason", async () => {
      mock.server.use(
        http.get("/v1/prompts/{prompt_identifier}/latest", ({ response }) =>
          response.untyped(HttpResponse.json({}, { status: 500 }))
        )
      );
      const bodies = captureCreateRequests();
      captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        runCreate(["--name", "greeting", "--template", "Hi", "--if-not-exists"])
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
      expect(bodies).toHaveLength(0);
    });
  });

  it.each([
    {
      case: "--name is missing",
      args: ["--template", "Hello"],
      message: "Missing required flag --name",
    },
    {
      case: "--name is not a valid identifier",
      args: ["--name", "My Prompt", "--template", "Hello"],
      message: 'Invalid value for --name: "My Prompt"',
    },
    {
      case: "no template is given",
      args: ["--name", "greeting"],
      message: "Missing a template",
    },
    {
      case: "both template flags are given",
      args: ["--name", "greeting", "--template", "Hi", "--template-file", "x"],
      message: "Pass either --template or --template-file, not both",
    },
    {
      case: "the template is blank",
      args: ["--name", "greeting", "--template", "   "],
      message: "Template is empty",
    },
    {
      case: "a non-OpenAI provider has no --model-name",
      args: ["--name", "g", "--template", "Hi", "--model-provider", "GOOGLE"],
      message: "--model-name is required for --model-provider GOOGLE",
    },
    {
      case: "the template file does not exist",
      args: ["--name", "g", "--template-file", "/no/such/file.txt"],
      message: 'Could not read --template-file "/no/such/file.txt"',
    },
    {
      case: "--message has no role",
      args: ["--name", "g", "--message", "Hello"],
      message: 'Invalid --message "Hello"',
    },
    {
      case: "--message has an unknown role",
      args: ["--name", "g", "--message", "robot=Hello"],
      message: 'Invalid --message role "robot"',
    },
    {
      case: "--param has no value",
      args: ["--name", "g", "--template", "Hi", "--param", "temperature"],
      message: 'Invalid --param "temperature"',
    },
    {
      case: "--invocation-parameters is not a JSON object",
      args: [
        "--name",
        "g",
        "--template",
        "Hi",
        "--invocation-parameters",
        "[1]",
      ],
      message: "--invocation-parameters must be a JSON object",
    },
    {
      case: "--metadata is not valid JSON",
      args: ["--name", "g", "--template", "Hi", "--metadata", "{team}"],
      message: "--metadata is not valid JSON",
    },
    {
      case: "two flags read from stdin",
      args: ["--name", "g", "--file", "-", "--template-file", "-"],
      message: "Only one flag can read from stdin (-)",
    },
  ])(
    "exits INVALID_ARGUMENT without calling the API when $case",
    async ({ args, message }) => {
      const bodies = captureCreateRequests();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(runCreate(args)).rejects.toThrow(
        `process.exit:${ExitCode.INVALID_ARGUMENT}`
      );

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(bodies).toHaveLength(0);
      expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining(message));
    }
  );

  it.each([
    { case: "is not valid JSON", contents: "{", message: "is not valid JSON" },
    {
      case: "is not a JSON object",
      contents: "[]",
      message: "--file must be a JSON object",
    },
  ])(
    "exits INVALID_ARGUMENT when --file $case",
    async ({ contents, message }) => {
      const filePath = writeTempFile({ fileName: "bad.json", contents });
      const bodies = captureCreateRequests();
      const io = captureCliOutput();
      mockProcessExit();

      await expect(
        runCreate(["--name", "g", "--file", filePath])
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(bodies).toHaveLength(0);
      expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining(message));
    }
  );

  it("exits INVALID_ARGUMENT with the server's validation message on a 422", async () => {
    mock.server.use(
      http.post("/v1/prompts", ({ response }) =>
        response.untyped(
          HttpResponse.json(
            {
              detail: [
                {
                  loc: [
                    "body",
                    "version",
                    "invocation_parameters",
                    "anthropic",
                    "anthropic",
                    "max_tokens",
                  ],
                  msg: "Field required",
                  type: "missing",
                },
              ],
            },
            { status: 422 }
          )
        )
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      runCreate([
        "--name",
        "qa",
        "--template",
        "Hi",
        "--model-provider",
        "ANTHROPIC",
        "--model-name",
        "claude-sonnet-5-5",
        "--format",
        "json",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(envelope).toEqual({
      error:
        "Error creating prompt: The server rejected the prompt version: version.invocation_parameters.anthropic.max_tokens: Field required",
      code: "INVALID_ARGUMENT",
      hint: "px prompt create --help",
    });
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(http.post("/v1/prompts", () => HttpResponse.error()));
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      runCreate(["--name", "greeting", "--template", "Hi"])
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    const io = captureCliOutput();

    await runCreate([
      "--name",
      "greeting",
      "--template",
      "Hello {{name}}",
      "--format",
      "raw",
    ]);

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(typeof parsed.id).toBe("string");
    expect(typeof parsed.model_name).toBe("string");
  });
});
