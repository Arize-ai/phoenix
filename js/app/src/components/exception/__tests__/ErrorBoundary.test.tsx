import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportClientError } from "@phoenix/utils/reportClientError";

import { ErrorBoundary } from "../ErrorBoundary";
import type { ErrorBoundaryFallbackProps } from "../types";

vi.mock("@phoenix/utils/reportClientError", () => ({
  reportClientError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs the thrown error itself as well; both are expected noise here.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(reportClientError).mockClear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  consoleError.mockRestore();
});

class NotFoundError extends Error {}

function Throws({ error }: { error: Error }): never {
  throw error;
}

function Fallback({ thrown }: ErrorBoundaryFallbackProps) {
  return (
    <output>
      {thrown instanceof NotFoundError ? "not found" : "something broke"}
    </output>
  );
}

function renderBoundary({
  error,
  isExpectedError,
}: {
  error: Error;
  isExpectedError?: (thrown: unknown) => boolean;
}) {
  act(() => {
    root.render(
      <ErrorBoundary fallback={Fallback} isExpectedError={isExpectedError}>
        <Throws error={error} />
      </ErrorBoundary>
    );
  });
}

describe("ErrorBoundary", () => {
  it("shows the fallback and reports an error", () => {
    renderBoundary({ error: new Error("boom") });
    expect(container.textContent).toBe("something broke");
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it("shows the fallback without reporting an expected error", () => {
    renderBoundary({
      error: new NotFoundError("Unknown node: stale"),
      isExpectedError: (thrown) => thrown instanceof NotFoundError,
    });
    expect(container.textContent).toBe("not found");
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("still reports an error the predicate does not expect", () => {
    renderBoundary({
      error: new Error("boom"),
      isExpectedError: (thrown) => thrown instanceof NotFoundError,
    });
    expect(container.textContent).toBe("something broke");
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });
});
