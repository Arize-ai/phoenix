/**
 * `px setup`'s exit-code contract: the verdict a caller scoring runs by exit
 * status reads, including the onboarding harness and the coding agent that
 * invoked setup in the first place.
 */

import { describe, expect, it } from "vitest";

import { setupExitCode } from "../src/commands/setup";
import { ExitCode } from "../src/exitCodes";
import type { SetupReport } from "../src/setup/runSetup";

const REPORT: SetupReport = {
  connection: {
    endpoint: "http://localhost:6006",
    projectName: "my-app",
  },
  authEnabled: false,
  headless: true,
  files: [".env.phoenix"],
  gitignored: [".env.phoenix"],
  instrumentation: { kind: "agent", agent: "claude", exitCode: 0 },
  tracesVerified: true,
  tracesUrl: "http://localhost:6006/redirects/projects/my-app",
};

describe("setupExitCode", () => {
  it("succeeds when a trace was verified arriving", () => {
    expect(setupExitCode(REPORT)).toBe(ExitCode.SUCCESS);
  });

  it("reports NOT_VERIFIED when instrumentation landed no trace", () => {
    expect(setupExitCode({ ...REPORT, tracesVerified: false })).toBe(
      ExitCode.NOT_VERIFIED
    );
  });

  it("reports NOT_VERIFIED when verification never produced a verdict", () => {
    expect(setupExitCode({ ...REPORT, tracesVerified: undefined })).toBe(
      ExitCode.NOT_VERIFIED
    );
  });

  it("succeeds on a registration-only run, which has nothing to verify", () => {
    expect(
      setupExitCode({
        ...REPORT,
        instrumentation: undefined,
        tracesVerified: undefined,
      })
    ).toBe(ExitCode.SUCCESS);
  });

  // The agent's own exit code is not the verdict: it may have instrumented the
  // app and then exited badly, or exited cleanly having delivered nothing.
  it("ignores the agent's exit code in favour of the trace verdict", () => {
    expect(
      setupExitCode({
        ...REPORT,
        instrumentation: { kind: "agent", agent: "claude", exitCode: 1 },
      })
    ).toBe(ExitCode.SUCCESS);
    expect(
      setupExitCode({
        ...REPORT,
        instrumentation: { kind: "agent", agent: "claude", exitCode: 0 },
        tracesVerified: false,
      })
    ).toBe(ExitCode.NOT_VERIFIED);
  });
});
