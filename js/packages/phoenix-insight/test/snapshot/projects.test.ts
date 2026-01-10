import { describe, it, expect, vi } from "vitest";
import { fetchProjects } from "../../src/snapshot/projects.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../../src/modes/types.js";
import { PhoenixClientError } from "../../src/snapshot/client.js";

describe("fetchProjects", () => {
  // Mock ExecutionMode
  const createMockMode = () => {
    const writtenFiles = new Map<string, string>();
    const mockMode: ExecutionMode = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles.set(path, content);
      }),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };
    return { mockMode, writtenFiles };
  };

  // Mock Phoenix client
  const createMockClient = (responseData: any, shouldError = false) => {
    const mockClient = {
      GET: vi.fn(async () => {
        if (shouldError) {
          throw new Error("API Error");
        }
        return {
          data: responseData,
          response: {} as any,
          error: undefined,
        };
      }),
    } as unknown as PhoenixClient;
    return mockClient;
  };

  it("should fetch projects and write them to the filesystem", async () => {
    const mockProjects = [
      {
        id: "project-1",
        name: "test-project-1",
        description: "Test project 1",
      },
      {
        id: "project-2",
        name: "test-project-2",
        description: "Test project 2",
      },
    ];

    const responseData = {
      data: mockProjects,
      next_cursor: null,
    };

    const mockClient = createMockClient(responseData);
    const { mockMode, writtenFiles } = createMockMode();

    await fetchProjects(mockClient, mockMode);

    // Check that GET was called with correct params
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/projects", {
      params: {
        query: {
          include_experiment_projects: false,
        },
      },
    });

    // Check that index.jsonl was written
    expect(writtenFiles.get("/phoenix/projects/index.jsonl")).toBe(
      mockProjects.map((p) => JSON.stringify(p)).join("\n")
    );

    // Check that metadata files were written for each project
    expect(
      writtenFiles.get("/phoenix/projects/test-project-1/metadata.json")
    ).toBe(JSON.stringify(mockProjects[0], null, 2));
    expect(
      writtenFiles.get("/phoenix/projects/test-project-2/metadata.json")
    ).toBe(JSON.stringify(mockProjects[1], null, 2));

    // Check that spans directories were created
    expect(
      writtenFiles.get("/phoenix/projects/test-project-1/spans/.gitkeep")
    ).toBe("");
    expect(
      writtenFiles.get("/phoenix/projects/test-project-2/spans/.gitkeep")
    ).toBe("");

    // Check total number of files written
    expect(mockMode.writeFile).toHaveBeenCalledTimes(5);
  });

  it("should handle empty projects list", async () => {
    const responseData = {
      data: [],
      next_cursor: null,
    };

    const mockClient = createMockClient(responseData);
    const { mockMode, writtenFiles } = createMockMode();

    await fetchProjects(mockClient, mockMode);

    // Check that only index.jsonl was written with empty content
    expect(writtenFiles.get("/phoenix/projects/index.jsonl")).toBe("");
    expect(mockMode.writeFile).toHaveBeenCalledTimes(1);
  });

  it("should handle API errors with proper error wrapping", async () => {
    const mockClient = createMockClient(null, true);
    const { mockMode } = createMockMode();

    await expect(fetchProjects(mockClient, mockMode)).rejects.toThrow(
      PhoenixClientError
    );

    // Ensure no files were written on error
    expect(mockMode.writeFile).not.toHaveBeenCalled();
  });

  it("should handle missing data in response", async () => {
    const mockClient = {
      GET: vi.fn(async () => ({
        data: undefined,
        response: {} as any,
        error: undefined,
      })),
    } as unknown as PhoenixClient;

    const { mockMode } = createMockMode();

    await expect(fetchProjects(mockClient, mockMode)).rejects.toThrow(
      "No data returned from projects endpoint"
    );
  });

  it("should handle projects with special characters in names", async () => {
    const mockProjects = [
      {
        id: "project-1",
        name: "test project with spaces",
        description: "Test project with spaces in name",
      },
      {
        id: "project-2",
        name: "test-project_with-special.chars",
        description: "Test project with special characters",
      },
    ];

    const responseData = {
      data: mockProjects,
      next_cursor: null,
    };

    const mockClient = createMockClient(responseData);
    const { mockMode, writtenFiles } = createMockMode();

    await fetchProjects(mockClient, mockMode);

    // Check that files were written with correct paths
    expect(
      writtenFiles.has(
        "/phoenix/projects/test project with spaces/metadata.json"
      )
    ).toBe(true);
    expect(
      writtenFiles.has(
        "/phoenix/projects/test-project_with-special.chars/metadata.json"
      )
    ).toBe(true);
  });

  it("should handle network errors properly", async () => {
    const mockClient = {
      GET: vi.fn(async () => {
        const error = new TypeError("fetch failed");
        throw error;
      }),
    } as unknown as PhoenixClient;

    const { mockMode } = createMockMode();

    await expect(fetchProjects(mockClient, mockMode)).rejects.toThrow(
      PhoenixClientError
    );

    const error = await fetchProjects(mockClient, mockMode).catch((e) => e);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toContain("Network error");
  });
});
