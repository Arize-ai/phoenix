import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrompt } from "../../src/prompts";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: vi.fn().mockResolvedValue({
      data: {
        data: {
          id: "mocked-prompt-id",
          // Add other expected prompt properties here
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
});
