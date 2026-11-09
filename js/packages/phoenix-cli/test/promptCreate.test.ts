import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPromptCommand } from "../src/commands/prompt";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

vi.mock("fs", async (importOriginal) => {
  const originalModule = await importOriginal<typeof fs>();
  return {
    ...originalModule,
    readFileSync: vi.fn(originalModule.readFileSync),
  };
});

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

    await createPromptCommand().parseAsync(
      [
        "create",
        "--name",
        "greeting",
        "--description",
        "says hello",
        "--template",
        "Hello {{name}}",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.prompt).toEqual({
      name: "greeting",
      description: "says hello",
    });
    expect(bodies[0]?.version).toMatchObject({
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
    vi.mocked(fs.readFileSync).mockImplementationOnce((source) => {
      expect(source).toBe(0);
      return "Piped {{name}}";
    });
    const bodies = captureCreateRequests();
    captureCliOutput();

    await createPromptCommand().parseAsync(
      ["create", "--name", "greeting", "--template-file", "-", ...BASE_ARGS],
      { from: "user" }
    );

    expect(bodies[0]?.version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Piped {{name}}" }],
    });
  });

  it("reads --template-file and accepts lowercase provider and format values", async () => {
    const templatePath = path.join(tempDir, "summarize.txt");
    fs.writeFileSync(templatePath, "Summarize: {text}\n");
    const bodies = captureCreateRequests();
    captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "create",
        "--name",
        "summarizer",
        "--template-file",
        templatePath,
        "--model-provider",
        "google",
        "--model-name",
        "gemini-2.5-flash",
        "--template-format",
        "f_string",
        "--max-tokens",
        "256",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(bodies[0]?.version).toMatchObject({
      model_provider: "GOOGLE",
      model_name: "gemini-2.5-flash",
      template_format: "F_STRING",
      template: {
        type: "chat",
        messages: [{ role: "user", content: "Summarize: {text}\n" }],
      },
      invocation_parameters: {
        type: "google",
        google: { max_output_tokens: 256 },
      },
    });
  });

  it.each([
    {
      provider: "OPENAI",
      invocationParameters: {
        type: "openai",
        openai: { max_completion_tokens: 512 },
      },
    },
    {
      provider: "ANTHROPIC",
      invocationParameters: {
        type: "anthropic",
        anthropic: { max_tokens: 512 },
      },
    },
  ])(
    "saves --max-tokens as the $provider max-tokens parameter",
    async ({ provider, invocationParameters }) => {
      const bodies = captureCreateRequests();
      captureCliOutput();

      await createPromptCommand().parseAsync(
        [
          "create",
          "--name",
          "greeting",
          "--template",
          "Hi",
          "--model-provider",
          provider,
          "--model-name",
          "some-model",
          "--max-tokens",
          "512",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );

      expect(bodies[0]?.version.invocation_parameters).toEqual(
        invocationParameters
      );
    }
  );

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

      await createPromptCommand().parseAsync(
        [
          "create",
          "--name",
          "greeting",
          "--template",
          "Hi",
          "--if-not-exists",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );

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

      await createPromptCommand().parseAsync(
        [
          "create",
          "--name",
          "greeting",
          "--template",
          "Hi",
          "--if-not-exists",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );

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
        createPromptCommand().parseAsync(
          [
            "create",
            "--name",
            "greeting",
            "--template",
            "Hi",
            "--if-not-exists",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
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
      message: 'Invalid --name "My Prompt"',
    },
    {
      case: "no template is given",
      args: ["--name", "greeting"],
      message: "Missing required flag --template or --template-file",
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
      case: "the provider is not supported",
      args: ["--name", "g", "--template", "Hi", "--model-provider", "acme"],
      message: 'Unsupported --model-provider "acme"',
    },
    {
      case: "a non-OpenAI provider has no --model-name",
      args: ["--name", "g", "--template", "Hi", "--model-provider", "GOOGLE"],
      message: "--model-name is required for --model-provider GOOGLE",
    },
    {
      case: "ANTHROPIC has no --max-tokens",
      args: [
        "--name",
        "g",
        "--template",
        "Hi",
        "--model-provider",
        "ANTHROPIC",
        "--model-name",
        "claude-sonnet-5-5",
      ],
      message: "--max-tokens is required for --model-provider ANTHROPIC",
    },
    {
      case: "--max-tokens is not a positive integer",
      args: ["--name", "g", "--template", "Hi", "--max-tokens", "0"],
      message: "--max-tokens must be a positive integer",
    },
    {
      case: "the template format is unknown",
      args: ["--name", "g", "--template", "Hi", "--template-format", "jinja"],
      message: 'Unsupported --template-format "jinja"',
    },
    {
      case: "the template file does not exist",
      args: ["--name", "g", "--template-file", "/no/such/file.txt"],
      message: 'Could not read template file "/no/such/file.txt"',
    },
  ])(
    "exits INVALID_ARGUMENT without calling the API when $case",
    async ({ args, message }) => {
      const bodies = captureCreateRequests();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createPromptCommand().parseAsync(["create", ...args, ...BASE_ARGS], {
          from: "user",
        })
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(bodies).toHaveLength(0);
      expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining(message));
    }
  );

  it("exits FAILURE with the response status when the server rejects the prompt", async () => {
    mock.server.use(
      http.post("/v1/prompts", ({ response }) =>
        response(422).text("Invalid identifier")
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["create", "--name", "greeting", "--template", "Hi", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("422 Unprocessable Entity")
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(http.post("/v1/prompts", () => HttpResponse.error()));
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createPromptCommand().parseAsync(
        ["create", "--name", "greeting", "--template", "Hi", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    const io = captureCliOutput();

    await createPromptCommand().parseAsync(
      [
        "create",
        "--name",
        "greeting",
        "--template",
        "Hello {{name}}",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(typeof parsed.id).toBe("string");
    expect(typeof parsed.model_name).toBe("string");
  });
});
