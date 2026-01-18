import type { componentsV1 } from "@arizeai/phoenix-client";

import {
  type ExperimentWithRuns,
  formatExperimentJsonOutput,
  formatExperimentOutput,
} from "../src/commands/formatExperiment";
import { formatExperimentsOutput } from "../src/commands/formatExperiments";

import { describe, expect, it } from "vitest";

type Experiment = componentsV1["schemas"]["Experiment"];
type ExperimentRun = componentsV1["schemas"]["ExperimentRun"];

// Mock experiment data
const mockExperiment1: Experiment = {
  id: "exp-abc123",
  dataset_id: "ds-123",
  dataset_version_id: "v1-abc",
  repetitions: 1,
  metadata: {},
  project_name: "my-project",
  created_at: "2026-01-15T10:00:00.000Z",
  updated_at: "2026-01-15T12:00:00.000Z",
  example_count: 10,
  successful_run_count: 8,
  failed_run_count: 2,
  missing_run_count: 0,
};

const mockExperiment2: Experiment = {
  id: "exp-xyz789",
  dataset_id: "ds-456",
  dataset_version_id: "v2-xyz",
  repetitions: 3,
  metadata: { model: "gpt-4" },
  project_name: null,
  created_at: "2026-01-14T08:00:00.000Z",
  updated_at: "2026-01-14T09:00:00.000Z",
  example_count: 5,
  successful_run_count: 15,
  failed_run_count: 0,
  missing_run_count: 0,
};

const mockRun1: ExperimentRun = {
  id: "run-001",
  experiment_id: "exp-abc123",
  dataset_example_id: "example-1",
  output: { result: "success" },
  repetition_number: 1,
  start_time: "2026-01-15T10:00:00.000Z",
  end_time: "2026-01-15T10:00:01.500Z",
  trace_id: "trace-abc",
  error: null,
};

const mockRunWithError: ExperimentRun = {
  id: "run-002",
  experiment_id: "exp-abc123",
  dataset_example_id: "example-2",
  output: null,
  repetition_number: 1,
  start_time: "2026-01-15T10:00:02.000Z",
  end_time: "2026-01-15T10:00:02.100Z",
  trace_id: null,
  error: "ValueError: Invalid input",
};

describe("Experiments Formatting", () => {
  describe("formatExperimentsOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment1],
        format: "raw",
      });

      expect(output).toBe(JSON.stringify([mockExperiment1]));
      expect(output).not.toContain("\n");
    });

    it("should handle empty array", () => {
      const output = formatExperimentsOutput({
        experiments: [],
        format: "raw",
      });

      expect(output).toBe("[]");
    });
  });

  describe("formatExperimentsOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment1],
        format: "json",
      });

      expect(output).toBe(JSON.stringify([mockExperiment1], null, 2));
      expect(output).toContain("\n");
    });

    it("should handle multiple experiments", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment1, mockExperiment2],
        format: "json",
      });

      expect(output).toBe(
        JSON.stringify([mockExperiment1, mockExperiment2], null, 2)
      );
    });
  });

  describe("formatExperimentsOutput - pretty", () => {
    it("should format experiments in human-readable format", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment1],
        format: "pretty",
      });

      expect(output).toContain("Experiments:");
      expect(output).toContain("┌─ exp-abc123 [Project: my-project]");
      expect(output).toContain("│  Dataset ID: ds-123");
      expect(output).toContain("│  Examples: 10");
      expect(output).toContain("│  Repetitions: 1");
      expect(output).toContain("│    ✓ Successful: 8");
      expect(output).toContain("│    ✗ Failed: 2");
      expect(output).toContain("│    ○ Missing: 0");
      expect(output).toContain("└─");
    });

    it("should handle experiments without project name", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment2],
        format: "pretty",
      });

      expect(output).toContain("┌─ exp-xyz789");
      expect(output).not.toContain("[Project:");
    });

    it("should handle empty array", () => {
      const output = formatExperimentsOutput({
        experiments: [],
        format: "pretty",
      });

      expect(output).toBe("No experiments found");
    });

    it("should show metadata if present", () => {
      const output = formatExperimentsOutput({
        experiments: [mockExperiment2],
        format: "pretty",
      });

      expect(output).toContain('Metadata: {"model":"gpt-4"}');
    });
  });
});

describe("Experiment (Single) Formatting", () => {
  const mockExperimentWithRuns: ExperimentWithRuns = {
    experiment: mockExperiment1,
    runs: [mockRun1, mockRunWithError],
  };

  describe("formatExperimentOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatExperimentOutput({
        data: mockExperimentWithRuns,
        format: "raw",
      });

      expect(output).toBe(JSON.stringify(mockExperimentWithRuns));
    });
  });

  describe("formatExperimentOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatExperimentOutput({
        data: mockExperimentWithRuns,
        format: "json",
      });

      expect(output).toBe(JSON.stringify(mockExperimentWithRuns, null, 2));
    });
  });

  describe("formatExperimentOutput - pretty", () => {
    it("should format experiment with runs in human-readable format", () => {
      const output = formatExperimentOutput({
        data: mockExperimentWithRuns,
        format: "pretty",
      });

      expect(output).toContain(
        "┌─ Experiment: exp-abc123 [Project: my-project]"
      );
      expect(output).toContain("│  Dataset ID: ds-123");
      expect(output).toContain("│  Run Summary:");
      expect(output).toContain("│    ✓ Successful: 8");
      expect(output).toContain("│  Runs (2):");
      expect(output).toContain("│    ✓ run-001");
      expect(output).toContain("[trace: trace-abc]");
      expect(output).toContain("│    ✗ run-002");
      expect(output).toContain("Error: ValueError: Invalid input");
    });

    it("should show output preview", () => {
      const output = formatExperimentOutput({
        data: mockExperimentWithRuns,
        format: "pretty",
      });

      expect(output).toContain('Output: {"result":"success"}');
    });
  });
});

describe("Experiment JSON Output Formatting", () => {
  const mockJsonData = JSON.stringify([
    {
      id: "run-001",
      example_id: "example-1",
      input: { question: "What is 2+2?" },
      output: { answer: "4" },
      expected_output: { answer: "4" },
      start_time: "2026-01-15T10:00:00.000Z",
      end_time: "2026-01-15T10:00:01.500Z",
      trace_id: "trace-abc",
      evaluations: {
        correctness: { score: 1.0, label: "correct" },
      },
    },
    {
      id: "run-002",
      example_id: "example-2",
      input: { question: "What is 3+3?" },
      output: null,
      error: "Timeout error",
      start_time: "2026-01-15T10:00:02.000Z",
      end_time: "2026-01-15T10:00:05.000Z",
    },
  ]);

  describe("formatExperimentJsonOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatExperimentJsonOutput({
        jsonData: mockJsonData,
        format: "raw",
      });

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });
  });

  describe("formatExperimentJsonOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatExperimentJsonOutput({
        jsonData: mockJsonData,
        format: "json",
      });

      expect(output).toContain("\n");
      expect(output).toContain("  ");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
    });
  });

  describe("formatExperimentJsonOutput - pretty", () => {
    it("should format experiment runs in human-readable format", () => {
      const output = formatExperimentJsonOutput({
        jsonData: mockJsonData,
        format: "pretty",
      });

      expect(output).toContain("Experiment Runs (2):");
      expect(output).toContain("┌─ ✓ Run: run-001");
      expect(output).toContain("│  Example ID: example-1");
      expect(output).toContain("│  Trace ID: trace-abc");
      expect(output).toContain('│  Input: {"question":"What is 2+2?"}');
      expect(output).toContain('│  Output: {"answer":"4"}');
      expect(output).toContain("│  Evaluations:");
      expect(output).toContain('- correctness: score=1, label="correct"');
    });

    it("should show errors for failed runs", () => {
      const output = formatExperimentJsonOutput({
        jsonData: mockJsonData,
        format: "pretty",
      });

      expect(output).toContain("┌─ ✗ Run: run-002");
      expect(output).toContain("│  Error: Timeout error");
    });
  });
});
