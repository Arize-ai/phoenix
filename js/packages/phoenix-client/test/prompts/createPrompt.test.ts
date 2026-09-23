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

  it("should send version metadata supplied to promptVersion", async () => {
    let sentBody: unknown;
    server.use(
      http.post("/v1/prompts", async ({ request, response }) => {
        sentBody = await request.json();
        return response(200).json({
          data: {
            id: "mocked-prompt-id",
            model_provider: "OPENAI",
            model_name: "gpt-4",
            template_type: "CHAT",
            template_format: "MUSTACHE",
            invocation_parameters: { type: "openai", openai: {} },
            template: {
              type: "chat",
              messages: [{ role: "user", content: "{{ question }}" }],
            },
          },
        });
      })
    );

    await createPrompt({
      client: createTestClient(),
      name: "test-prompt",
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "gpt-4",
        metadata: { agent: "support", dependencies: ["retriever"] },
        template: [{ role: "user", content: "{{ question }}" }],
      }),
    });

    expect(sentBody).toMatchObject({
      version: { metadata: { agent: "support", dependencies: ["retriever"] } },
    });
  });

  it("should omit version metadata when it is not supplied", async () => {
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.post("/v1/prompts", async ({ request, response }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return response(200).json({
          data: {
            id: "mocked-prompt-id",
            model_provider: "OPENAI",
            model_name: "gpt-4",
            template_type: "CHAT",
            template_format: "MUSTACHE",
            invocation_parameters: { type: "openai", openai: {} },
            template: {
              type: "chat",
              messages: [{ role: "user", content: "{{ question }}" }],
            },
          },
        });
      })
    );

    await createPrompt({
      client: createTestClient(),
      name: "test-prompt",
      version: promptVersion({
        modelProvider: "OPENAI",
        modelName: "gpt-4",
        template: [{ role: "user", content: "{{ question }}" }],
      }),
    });

    expect(sentBody?.version).not.toHaveProperty("metadata");
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
