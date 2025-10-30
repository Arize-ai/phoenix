import { createPrompt, promptVersion } from "../../src/prompts";

import { beforeEach,describe, expect, it, vi } from "vitest";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: vi.fn().mockResolvedValue({
      data: {
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
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("createPrompt", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should create a prompt", async () => {
    const prompt = await createPrompt({
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
    const prompt = await createPrompt({
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
});
