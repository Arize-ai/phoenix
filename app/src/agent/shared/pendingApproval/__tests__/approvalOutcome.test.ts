import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { approvalOutcome } from "../approvalOutcome";

describe("approvalOutcome", () => {
  it("nests the decision and source under a reserved approval key", () => {
    expect(approvalOutcome({ decision: "accepted", source: "user" })).toEqual({
      approval: { decision: "accepted", source: "user" },
    });
    expect(approvalOutcome({ decision: "rejected", source: "user" })).toEqual({
      approval: { decision: "rejected", source: "user" },
    });
  });

  it("survives being spread after a payload that carries its own approval key", () => {
    // `pendingSavePrompt` and `pendingPromptToolWrite` spread a tool's own
    // action result into the output. Spreading the marker last is what keeps a
    // colliding key from silently winning.
    const toolPayload = { status: "saved", approval: "not-the-marker" };
    const output = {
      ...toolPayload,
      ...approvalOutcome({ decision: "accepted", source: "auto" }),
    };
    expect(output.approval).toEqual({ decision: "accepted", source: "auto" });
  });
});

/**
 * Drift guard. The whole point of the marker is that trace consumers never need
 * a hand-maintained list of approval-gated tool names — which only holds while
 * every gated tool actually stamps it. New `pending*.ts` modules are the way
 * gated tools get added, so require the stamp there rather than trusting review.
 */
describe("approval marker coverage", () => {
  const agentDir = join(__dirname, "..", "..", "..");

  function pendingModules(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "__tests__" ? [] : pendingModules(path);
      }
      return entry.name.startsWith("pending") && entry.name.endsWith(".ts")
        ? [path]
        : [];
    });
  }

  const modules = pendingModules(agentDir);

  it("finds the pending approval modules to check", () => {
    expect(modules.length).toBeGreaterThan(5);
  });

  it.each(modules)("%s stamps both approval branches", (path) => {
    const source = readFileSync(path, "utf-8");
    // Modules that delegate to `bindPendingApproval` emit no output of their
    // own and are covered by the generic core's own tests.
    if (!source.includes('state: "output-available"')) return;
    if (source.includes("accept: async")) {
      expect(source).toContain('decision: "accepted"');
    }
    if (source.includes("reject: async")) {
      expect(source).toContain('decision: "rejected"');
    }
  });
});
