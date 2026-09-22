import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CREATE_PROMPT_CUSTOM_PROVIDER } from "../../src/constants/serverRequirements";
import { createPrompt, promptVersion } from "../../src/prompts";
import { ensureServerCapability } from "../../src/utils/serverVersionUtils";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/**
 * Register a handler for the prompt creation endpoint that answers with a
 * canned prompt version payload.
 */
function stubPromptCreation() {
  server.use(
    http.post("/v1/prompts", ({ response }) =>
      response(200).json({
        data: {
          id: "mocked-prompt-id",
          description: "test-description",
          model_provider: "OPENAI",
          model_name: "gpt-3.5-turbo",
          template_type: "CHAT",
          template_format: "MUSTACHE",
          invocation_parameters: {
            type: "openai",
            openai: {
              temperature: 0.5,
            },
          },
          template: {
            type: "chat",
            messages: [
              {
                role: "user",
                content: "{{ question }}",
              },
            ],
          },
        },
      })
    )
  );
}

describe("createPrompt", () => {
  it("should create a prompt", async () => {
    stubPromptCreation();

    const prompt = await createPrompt({
      client: createTestClient(),
      name: "test-prompt",
      description: "test-description",
      version: {
        description: "test-description",
        model_provider: "OPENAI",
        model_name: "gpt-3.5-turbo",
        template_type: "CHAT",
        template_format: "MUSTACHE",
        invocation_parameters: {
          type: "openai",
          openai: {
            temperature: 0.5,
          },
        },
        template: {
          type: "chat",
          messages: [
            {
              role: "user",
              content: "{{ question }}",
            },
          ],
        },
      },
    });

    expect(prompt).toBeDefined();
    expect(prompt.id).toBe("mocked-prompt-id");
  });
  it("should let you craate a prompt usering promptVersion", async () => {
    stubPromptCreation();

    const prompt = await createPrompt({
      client: createTestClient(),
      name: "test-prompt",
      description: "test-description",
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "gpt-3.5-turbo",
        template: [
          {
            role: "user",
            content: "{{ question }}",
          },
        ],
        invocationParameters: {
          temperature: 0.5,
        },
      }),
    });
    expect(prompt).toBeDefined();
    expect(prompt.id).toBe("mocked-prompt-id");
  });

  it("should carry customProviderId through promptVersion", () => {
    const version = promptVersion({
      modelProvider: "OPENAI",
      modelName: "my-hosted-model",
      customProviderId: "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ==",
      template: [{ role: "user", content: "{{ question }}" }],
    });

    expect(version.custom_provider_id).toBe(
      "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ=="
    );
    expect(version.model_provider).toBe("OPENAI");
    expect(version.invocation_parameters).toEqual({
      type: "openai",
      openai: {},
    });
  });
  it("should omit custom_provider_id from promptVersion when not given", () => {
    const version = promptVersion({
      modelProvider: "ANTHROPIC",
      modelName: "claude-sonnet-5",
      template: [{ role: "user", content: "{{ question }}" }],
      invocationParameters: { max_tokens: 1024 },
    });

    expect("custom_provider_id" in version).toBe(false);
    expect(version.invocation_parameters).toEqual({
      type: "anthropic",
      anthropic: { max_tokens: 1024 },
    });
  });
  it("checks the server version only when a custom provider is set", async () => {
    stubPromptCreation();
    const guard = vi.mocked(ensureServerCapability);
    guard.mockClear();

    await createPrompt({
      client: createTestClient(),
      name: "plain",
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "gpt-4o",
        template: [{ role: "user", content: "hi" }],
      }),
    });
    expect(guard).not.toHaveBeenCalled();

    await createPrompt({
      client: createTestClient(),
      name: "custom",
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "my-hosted-model",
        customProviderId: "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ==",
        template: [{ role: "user", content: "hi" }],
      }),
    });
    expect(guard).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: CREATE_PROMPT_CUSTOM_PROVIDER })
    );
  });
  it("should create a prompt with metadata", async () => {
    stubPromptCreation();

    const prompt = await createPrompt({
      client: createTestClient(),
      name: "test-prompt",
      description: "test-description",
      metadata: {
        environment: "production",
        version: "1.0",
        team: "ai",
      },
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "gpt-4",
        template: [
          {
            role: "user",
            content: "{{ question }}",
          },
        ],
        invocationParameters: {
          temperature: 0.7,
        },
      }),
    });
    expect(prompt).toBeDefined();
    expect(prompt.id).toBe("mocked-prompt-id");
  });
});
