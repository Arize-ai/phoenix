import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SnapshotProgress,
  AgentProgress,
  SimpleProgress,
} from "../src/progress";

// Mock ora to prevent actual spinner creation
vi.mock("ora");

describe("SnapshotProgress", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not create spinner when disabled", () => {
    const progress = new SnapshotProgress(false);
    progress.start("Test message");
    progress.update("Test phase");
    progress.succeed();

    // No spinner should be created when disabled
  });

  it("should create and update spinner when enabled", async () => {
    const progress = new SnapshotProgress(true);
    const ora = (await import("ora")).default as any;

    // Reset the mock before testing
    ora.mockReset();
    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.start("Creating snapshot");
    expect(ora).toHaveBeenCalledWith({
      text: "Creating snapshot",
      spinner: "dots",
      color: "blue",
    });
    expect(mockSpinner.start).toHaveBeenCalled();

    progress.update("Fetching projects", "10 projects found");
    expect(mockSpinner.text).toContain("Fetching projects: 10 projects found");
    expect(mockSpinner.text).toContain("%");

    progress.succeed("Custom success message");
    expect(mockSpinner.succeed).toHaveBeenCalledWith("Custom success message");
  });

  it("should handle failures properly", async () => {
    const progress = new SnapshotProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.start();
    progress.fail("Something went wrong");
    expect(mockSpinner.fail).toHaveBeenCalledWith("Something went wrong");
  });

  it("should stop spinner", async () => {
    const progress = new SnapshotProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.start();
    progress.stop();
    expect(mockSpinner.stop).toHaveBeenCalled();
  });
});

describe("AgentProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not create spinner when disabled", () => {
    const progress = new AgentProgress(false);
    progress.startThinking();
    progress.updateTool("bash", "running ls");
    progress.stop();

    // No spinner operations when disabled
  });

  it("should show thinking indicator when enabled", async () => {
    const progress = new AgentProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.startThinking();
    expect(ora).toHaveBeenCalledWith({
      text: "🤔 Analyzing...",
      spinner: "dots",
      color: "cyan",
    });
    expect(mockSpinner.start).toHaveBeenCalled();
  });

  it("should update tool usage", async () => {
    const progress = new AgentProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.startThinking();
    progress.updateTool("bash", "listing files");
    expect(mockSpinner.text).toBe("🔧 Running command: listing files");

    progress.updateTool("px_fetch_more_spans");
    expect(mockSpinner.text).toBe("🔧 Fetching additional spans (step 2)");

    progress.updateTool("px_fetch_more_trace");
    expect(mockSpinner.text).toBe("🔧 Fetching trace details (step 3)");
  });

  it("should update tool results", async () => {
    const progress = new AgentProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.startThinking();
    progress.updateToolResult("bash", true);
    expect(mockSpinner.text).toBe("✓ Command executed completed");

    progress.updateToolResult("px_fetch_more_spans", false);
    expect(mockSpinner.text).toBe("✗ Additional spans fetched failed");

    progress.updateToolResult("px_fetch_more_trace", true);
    expect(mockSpinner.text).toBe("✓ Trace details fetched completed");
  });

  it("should update with specific action", async () => {
    const progress = new AgentProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.startThinking();
    progress.updateAction("Searching for error patterns");
    expect(mockSpinner.text).toBe("🔍 Searching for error patterns...");
  });

  it("should succeed with message", async () => {
    const progress = new AgentProgress(true);
    const ora = (await import("ora")).default as any;

    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      text: "",
    };
    ora.mockReturnValue(mockSpinner);

    progress.startThinking();
    progress.succeed("Found the answer!");
    expect(mockSpinner.succeed).toHaveBeenCalledWith("Found the answer!");
  });
});

describe("SimpleProgress", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not log when disabled", () => {
    const progress = new SimpleProgress(false);

    progress.log("Test message");
    progress.info("Info message");
    progress.success("Success message");
    progress.warning("Warning message");
    progress.error("Error message");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should log messages with appropriate prefixes", () => {
    const progress = new SimpleProgress(true);

    progress.log("Test message");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[Phoenix Insight] Test message"
    );

    progress.info("Info message");
    expect(consoleLogSpy).toHaveBeenCalledWith("ℹ️  Info message");

    progress.success("Success message");
    expect(consoleLogSpy).toHaveBeenCalledWith("✅ Success message");

    progress.warning("Warning message");
    expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Warning message");

    progress.error("Error message");
    expect(consoleLogSpy).toHaveBeenCalledWith("❌ Error message");
  });
});
