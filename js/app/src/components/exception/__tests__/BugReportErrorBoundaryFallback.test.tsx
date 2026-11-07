import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BugReportErrorBoundaryFallback } from "../BugReportErrorBoundaryFallback";
import { ServerResponseError } from "../serverConnectionError";

// The message RelayEnvironment builds for the failure reported in #16285.
const UPSTREAM_RESET_503 =
  "GraphQL request failed: the server returned a non-JSON response " +
  "(status 503 ): upstream connect error or disconnect/reset before " +
  "headers. reset reason: connection termination";

function linkHrefs(): (string | null)[] {
  return Array.from(container.querySelectorAll("a")).map((anchor) =>
    anchor.getAttribute("href")
  );
}

let container: HTMLDivElement;
let root: Root;

function render(thrown: Error) {
  act(() => {
    root.render(
      <BugReportErrorBoundaryFallback error={thrown.message} thrown={thrown} />
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("BugReportErrorBoundaryFallback", () => {
  it("explains an unavailable service instead of asking for a bug report", () => {
    render(new ServerResponseError(UPSTREAM_RESET_503, 503));

    expect(container.querySelector("h1")?.textContent).toBe(
      "Phoenix is unavailable"
    );
    expect(container.textContent).not.toContain("bugs happen");
    expect(linkHrefs()).toEqual([]);
    expect(container.textContent).not.toContain("timed out");
    expect(container.textContent).toContain("returned an error");
    const details = container.querySelector("details");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.textContent).toContain(UPSTREAM_RESET_503);
  });

  it("describes a gateway timeout as a timeout", () => {
    render(
      new ServerResponseError(
        "GraphQL request failed with status 504 Gateway Timeout: {}",
        504
      )
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "Connection timed out"
    );
    expect(container.textContent).toContain(
      "Increase your load balancer or proxy timeout settings"
    );
  });

  it("asks for a bug report for an ordinary application error", () => {
    render(new TypeError("Cannot read property 'id' of undefined"));

    expect(container.querySelector("h1")?.textContent).toBe(
      "Something went wrong"
    );
    expect(container.textContent).toContain("bugs happen");
    expect(linkHrefs()).toEqual([
      "https://github.com/Arize-ai/phoenix/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D",
    ]);
  });

  it("asks for a bug report when Phoenix reports a failure to reach something else", () => {
    render(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    expect(container.querySelector("h1")?.textContent).toBe(
      "Something went wrong"
    );
    expect(container.textContent).not.toContain("Phoenix is unavailable");
  });
});
