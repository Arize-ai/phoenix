import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrompt, promptVersion } from "../../src/prompts";
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
