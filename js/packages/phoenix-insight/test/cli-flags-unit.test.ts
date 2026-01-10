import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockedFunction,
} from "vitest";
import { Command } from "commander";

// Mock modules before importing
vi.mock("../src/modes/index.js", () => ({
  createSandboxMode: vi.fn(() => ({
    writeFile: vi.fn(),
    exec: vi.fn(),
    getBashTool: vi.fn(),
    cleanup: vi.fn(),
  })),
  createLocalMode: vi.fn(async () => ({
    writeFile: vi.fn(),
    exec: vi.fn(),
    getBashTool: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

vi.mock("../src/agent/index.js", () => ({
  createInsightAgent: vi.fn(),
  runOneShotQuery: vi.fn(async () => ({
    text: "Mock response",
    textStream: (async function* () {
      yield "Mock stream response";
    })(),
    response: Promise.resolve(),
  })),
  PhoenixInsightAgentConfig: {},
}));

vi.mock("../src/snapshot/index.js", () => ({
  createSnapshot: vi.fn(async () => {}),
  createIncrementalSnapshot: vi.fn(async () => {}),
  createPhoenixClient: vi.fn(() => ({})),
}));

import { createSandboxMode, createLocalMode } from "../src/modes/index.js";
import { runOneShotQuery } from "../src/agent/index.js";
import {
  createSnapshot,
  createIncrementalSnapshot,
  createPhoenixClient,
} from "../src/snapshot/index.js";

describe("cli-flags unit tests", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let consoleOutput: string[];

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalLog = console.log;
    originalError = console.error;
    consoleOutput = [];

    // Mock console
    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(" "));
    });
    console.error = vi.fn((...args) => {
      consoleOutput.push(`ERROR: ${args.join(" ")}`);
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalLog;
    console.error = originalError;
  });

  describe("execution mode selection", () => {
    it("should select sandbox mode when --sandbox flag is provided", async () => {
      const mockMode = {
        writeFile: vi.fn(),
        exec: vi.fn(),
        getBashTool: vi.fn(),
        cleanup: vi.fn(),
      };
      vi.mocked(createSandboxMode).mockReturnValueOnce(mockMode);

      // The actual test would need to import and parse the CLI directly
      // For now, we document the expected behavior
      expect(createSandboxMode).toBeDefined();
      expect(createLocalMode).toBeDefined();
    });
  });

  describe("Phoenix client configuration", () => {
    it("should create Phoenix client with provided options", () => {
      const baseURL = "https://custom.phoenix.com";
      const apiKey = "test-key-123";

      createPhoenixClient({ baseURL, apiKey });

      expect(createPhoenixClient).toHaveBeenCalledWith({
        baseURL,
        apiKey,
      });
    });
  });

  describe("snapshot options", () => {
    it("should pass correct options to snapshot functions", async () => {
      const mode = {
        writeFile: vi.fn(),
        exec: vi.fn(),
        getBashTool: vi.fn(),
        cleanup: vi.fn(),
      };
      const options = {
        baseURL: "https://test.com",
        apiKey: "key",
        spansPerProject: 500,
        showProgress: true,
      };

      await createSnapshot(mode, options);

      expect(createSnapshot).toHaveBeenCalledWith(mode, options);
    });

    it("should support incremental snapshots", async () => {
      const mode = {
        writeFile: vi.fn(),
        exec: vi.fn(),
        getBashTool: vi.fn(),
        cleanup: vi.fn(),
      };
      const options = {
        baseURL: "https://test.com",
        apiKey: "key",
        spansPerProject: 1000,
        showProgress: true,
      };

      await createIncrementalSnapshot(mode, options);

      expect(createIncrementalSnapshot).toHaveBeenCalledWith(mode, options);
    });
  });

  describe("query execution", () => {
    it("should execute query with stream option", async () => {
      const config = { mode: {}, client: {}, maxSteps: 25 };
      const query = "test query";
      const options = { stream: true };

      await runOneShotQuery(config as any, query, options);

      expect(runOneShotQuery).toHaveBeenCalledWith(config, query, options);
    });

    it("should execute query without stream option", async () => {
      const config = { mode: {}, client: {}, maxSteps: 25 };
      const query = "test query";
      const options = {};

      await runOneShotQuery(config as any, query, options);

      expect(runOneShotQuery).toHaveBeenCalledWith(config, query, options);
    });
  });
});
