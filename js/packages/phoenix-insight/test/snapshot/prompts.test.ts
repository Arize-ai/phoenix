import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../../src/modes/types.js";
import { fetchPrompts } from "../../src/snapshot/prompts.js";

// Mock the client error handling module
vi.mock("../../src/snapshot/client.js", () => ({
  withErrorHandling: async (fn: () => Promise<any>, context: string) => {
    try {
      return await fn();
    } catch (error) {
      throw error;
    }
  },
  extractData: (response: any) => {
    if (response.error) throw response.error;
    if (!response.data) throw new Error("No data in response");
    return response.data;
  },
}));

describe("fetchPrompts", () => {
  let mockClient: PhoenixClient;
  let mockMode: ExecutionMode;
  let writtenFiles: Record<string, string>;

  beforeEach(() => {
    writtenFiles = {};
    mockMode = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles[path] = content;
      }),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    } as ExecutionMode;

    mockClient = {
      GET: vi.fn(),
    } as unknown as PhoenixClient;
  });

  it("should fetch and write prompts with their versions", async () => {
    // Mock prompts list response
    const mockPrompts = [
      {
        id: "prompt-1",
        name: "test-prompt",
        description: "Test prompt description",
        metadata: { category: "test" },
        source_prompt_id: null,
      },
      {
        id: "prompt-2",
        name: "another-prompt",
        description: null,
        metadata: null,
        source_prompt_id: "prompt-1",
      },
    ];

    // Mock versions for first prompt
    const mockVersions1 = [
      {
        id: "version-1",
        model_name: "gpt-4",
        model_provider: "OPENAI",
        template_format: "STRING",
        template: {
          type: "string",
          template: "You are a helpful assistant. {{input}}",
        },
        invocation_parameters: { temperature: 0.7, max_tokens: 100 },
        description: "Initial version",
        tools: null,
        response_format: null,
      },
      {
        id: "version-2",
        model_name: "gpt-4",
        model_provider: "OPENAI",
        template_format: "CHAT",
        template: {
          type: "chat",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "{{input}}" },
          ],
        },
        invocation_parameters: { temperature: 0.5, max_tokens: 200 },
        description: "Chat format version",
        tools: {
          tools: [
            {
              name: "search",
              description: "Search for information",
              parameters: {
                type: "object",
                properties: { query: { type: "string" } },
              },
            },
          ],
        },
        response_format: {
          type: "json_schema",
          json_schema: { name: "answer", schema: {} },
        },
      },
    ];

    // Mock versions for second prompt
    const mockVersions2 = [
      {
        id: "version-3",
        model_name: "claude-3-sonnet",
        model_provider: "ANTHROPIC",
        template_format: "STRING",
        template: "Answer concisely: {{question}}",
        invocation_parameters: { max_tokens: 50 },
        description: null,
        tools: null,
        response_format: null,
      },
    ];

    // Set up mock client responses
    (mockClient.GET as any)
      .mockImplementationOnce(async (path: string, options: any) => {
        if (path === "/v1/prompts") {
          return {
            data: {
              data: mockPrompts,
              next_cursor: null,
            },
          };
        }
      })
      .mockImplementationOnce(async (path: string, options: any) => {
        if (path === "/v1/prompts/{prompt_identifier}/versions") {
          expect(options.params.path.prompt_identifier).toBe("prompt-1");
          return {
            data: {
              data: mockVersions1,
              next_cursor: null,
            },
          };
        }
      })
      .mockImplementationOnce(async (path: string, options: any) => {
        if (path === "/v1/prompts/{prompt_identifier}/latest") {
          expect(options.params.path.prompt_identifier).toBe("prompt-1");
          return {
            data: {
              data: mockVersions1[1], // Latest is version-2
            },
          };
        }
      })
      .mockImplementationOnce(async (path: string, options: any) => {
        if (path === "/v1/prompts/{prompt_identifier}/versions") {
          expect(options.params.path.prompt_identifier).toBe("prompt-2");
          return {
            data: {
              data: mockVersions2,
              next_cursor: null,
            },
          };
        }
      })
      .mockImplementationOnce(async (path: string, options: any) => {
        if (path === "/v1/prompts/{prompt_identifier}/latest") {
          expect(options.params.path.prompt_identifier).toBe("prompt-2");
          return {
            data: {
              data: mockVersions2[0],
            },
          };
        }
      });

    // Execute
    await fetchPrompts(mockClient, mockMode);

    // Verify prompts index was written
    expect(writtenFiles["/phoenix/prompts/index.jsonl"]).toBeDefined();
    const promptsIndex = writtenFiles["/phoenix/prompts/index.jsonl"]
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(promptsIndex).toHaveLength(2);
    expect(promptsIndex[0].name).toBe("test-prompt");
    expect(promptsIndex[1].name).toBe("another-prompt");

    // Verify metadata files were written
    expect(
      writtenFiles["/phoenix/prompts/test-prompt/metadata.json"]
    ).toBeDefined();
    const metadata1 = JSON.parse(
      writtenFiles["/phoenix/prompts/test-prompt/metadata.json"]
    );
    expect(metadata1.id).toBe("prompt-1");
    expect(metadata1.name).toBe("test-prompt");
    expect(metadata1.description).toBe("Test prompt description");

    // Verify versions index was written
    expect(
      writtenFiles["/phoenix/prompts/test-prompt/versions/index.jsonl"]
    ).toBeDefined();
    const versions1Index = writtenFiles[
      "/phoenix/prompts/test-prompt/versions/index.jsonl"
    ]
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(versions1Index).toHaveLength(2);

    // Verify version markdown files were written
    expect(
      writtenFiles["/phoenix/prompts/test-prompt/versions/version-1.md"]
    ).toBeDefined();
    expect(
      writtenFiles["/phoenix/prompts/test-prompt/versions/version-2.md"]
    ).toBeDefined();

    // Check string template markdown content
    const version1Md =
      writtenFiles["/phoenix/prompts/test-prompt/versions/version-1.md"];
    expect(version1Md).toContain("id: version-1");
    expect(version1Md).toContain("model_name: gpt-4");
    expect(version1Md).toContain("template_format: STRING");
    expect(version1Md).toContain("You are a helpful assistant. {{input}}");
    expect(version1Md).toContain("## Invocation Parameters");
    expect(version1Md).toContain('"temperature": 0.7');

    // Check chat template markdown content
    const version2Md =
      writtenFiles["/phoenix/prompts/test-prompt/versions/version-2.md"];
    expect(version2Md).toContain("# Chat Template");
    expect(version2Md).toContain("## system");
    expect(version2Md).toContain("You are a helpful assistant.");
    expect(version2Md).toContain("## user");
    expect(version2Md).toContain("{{input}}");
    expect(version2Md).toContain("## Tools");
    expect(version2Md).toContain("## Response Format");

    // Verify latest version was written
    expect(
      writtenFiles["/phoenix/prompts/test-prompt/latest.md"]
    ).toBeDefined();
    expect(writtenFiles["/phoenix/prompts/test-prompt/latest.md"]).toBe(
      version2Md
    );
  });

  it("should handle prompts with special characters in names", async () => {
    const mockPrompt = {
      id: "prompt-special",
      name: "test/prompt with spaces & symbols!",
      description: null,
      metadata: null,
      source_prompt_id: null,
    };

    (mockClient.GET as any)
      .mockImplementationOnce(async () => ({
        data: { data: [mockPrompt], next_cursor: null },
      }))
      .mockImplementationOnce(async () => ({
        data: { data: [], next_cursor: null },
      }))
      .mockImplementationOnce(async () => ({
        error: new Error("No latest version"),
      }));

    await fetchPrompts(mockClient, mockMode);

    // Verify safe filename was used
    expect(
      writtenFiles[
        "/phoenix/prompts/test_prompt_with_spaces___symbols_/metadata.json"
      ]
    ).toBeDefined();
  });

  it("should handle pagination for prompts", async () => {
    const mockPromptsPage1 = Array(100)
      .fill(null)
      .map((_, i) => ({
        id: `prompt-${i}`,
        name: `prompt-${i}`,
        description: null,
        metadata: null,
        source_prompt_id: null,
      }));

    const mockPromptsPage2 = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: `prompt-${i + 100}`,
        name: `prompt-${i + 100}`,
        description: null,
        metadata: null,
        source_prompt_id: null,
      }));

    let promptCallCount = 0;
    (mockClient.GET as any).mockImplementation(async (path: string) => {
      if (path === "/v1/prompts") {
        if (promptCallCount === 0) {
          promptCallCount++;
          return {
            data: { data: mockPromptsPage1, next_cursor: "cursor-1" },
          };
        } else {
          return {
            data: { data: mockPromptsPage2, next_cursor: null },
          };
        }
      }
      // Return empty versions for all other calls
      return { data: { data: [], next_cursor: null } };
    });

    await fetchPrompts(mockClient, mockMode, { limit: 150 });

    // Verify all prompts were fetched
    const promptsIndex = writtenFiles["/phoenix/prompts/index.jsonl"]
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(promptsIndex).toHaveLength(150);
  });

  it("should handle multi-part chat messages", async () => {
    const mockPrompt = {
      id: "prompt-multipart",
      name: "multipart-prompt",
      description: null,
      metadata: null,
      source_prompt_id: null,
    };

    const mockVersion = {
      id: "version-multipart",
      model_name: "gpt-4",
      model_provider: "OPENAI",
      template_format: "CHAT",
      template: {
        type: "chat",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image:" },
              {
                type: "image_url",
                image_url: { url: "https://example.com/image.jpg" },
              },
            ],
          },
        ],
      },
      invocation_parameters: {},
      description: null,
      tools: null,
      response_format: null,
    };

    (mockClient.GET as any)
      .mockImplementationOnce(async () => ({
        data: { data: [mockPrompt], next_cursor: null },
      }))
      .mockImplementationOnce(async () => ({
        data: { data: [mockVersion], next_cursor: null },
      }))
      .mockImplementationOnce(async () => ({
        data: { data: mockVersion },
      }));

    await fetchPrompts(mockClient, mockMode);

    const versionMd =
      writtenFiles[
        "/phoenix/prompts/multipart-prompt/versions/version-multipart.md"
      ];
    expect(versionMd).toContain("Describe this image:");
    expect(versionMd).toContain("```json");
    expect(versionMd).toContain('"type": "image_url"');
  });

  it("should gracefully handle missing latest version", async () => {
    const mockPrompt = {
      id: "prompt-no-latest",
      name: "no-latest",
      description: null,
      metadata: null,
      source_prompt_id: null,
    };

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    (mockClient.GET as any)
      .mockImplementationOnce(async () => ({
        data: { data: [mockPrompt], next_cursor: null },
      }))
      .mockImplementationOnce(async () => ({
        data: { data: [], next_cursor: null },
      }))
      .mockImplementationOnce(async () => {
        throw new Error("No latest version found");
      });

    await fetchPrompts(mockClient, mockMode);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "No latest version available for prompt no-latest"
      )
    );

    // Should not have written latest.md
    expect(
      writtenFiles["/phoenix/prompts/no-latest/latest.md"]
    ).toBeUndefined();

    consoleWarnSpy.mockRestore();
  });

  it("should respect the limit option", async () => {
    const mockPrompts = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `prompt-${i}`,
        name: `prompt-${i}`,
        description: null,
        metadata: null,
        source_prompt_id: null,
      }));

    (mockClient.GET as any).mockImplementation(async (path: string) => {
      if (path === "/v1/prompts") {
        return { data: { data: mockPrompts.slice(0, 5), next_cursor: null } };
      }
      return { data: { data: [], next_cursor: null } };
    });

    await fetchPrompts(mockClient, mockMode, { limit: 5 });

    const promptsIndex = writtenFiles["/phoenix/prompts/index.jsonl"]
      .split("\n")
      .filter(Boolean);
    expect(promptsIndex).toHaveLength(5);
  });
});
