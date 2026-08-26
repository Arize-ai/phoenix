import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { SpanEventAttributes } from "../SpanEventsList";

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderAttributes({
  name,
  attributes,
}: {
  name: string;
  attributes: unknown;
}) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <SpanEventAttributes
          event={{
            name,
            message: "",
            timestamp: "2026-08-03T12:00:00.000Z",
            attributes,
          }}
        />
      </ThemeProvider>
    );
  });
}

describe("SpanEventAttributes", () => {
  it("renders an exception stack trace as preformatted text", async () => {
    const stacktrace = [
      "Traceback (most recent call last):",
      '  File "/app/main.py", line 10, in run',
      "    result = 1 / 0",
      "ZeroDivisionError: division by zero",
    ].join("\n");

    await renderAttributes({
      name: "exception",
      attributes: {
        "exception.type": "ZeroDivisionError",
        "exception.message": "division by zero",
        "exception.stacktrace": stacktrace,
      },
    });

    const stacktraceElement = container.querySelector(
      "[data-testid='pre-block']"
    );
    expect(stacktraceElement?.textContent).toBe(stacktrace);
    expect(
      container.querySelector("button[aria-label='Copy stack trace']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).not.toContain(
      "exception.stacktrace"
    );
    expect(
      container.querySelector("[aria-label='JSON view mode']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).toContain(
      "exception.type"
    );
  });

  it("uses the shared attribute viewer for non-exception events", async () => {
    await renderAttributes({
      name: "retry",
      attributes: {
        attempt: 2,
        context: '{"reason":"rate limit"}',
      },
    });

    expect(container.querySelector("[data-testid='pre-block']")).toBeNull();
    expect(
      container.querySelector("[aria-label='JSON view mode']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).toContain("attempt");
    expect(container.querySelector("table")?.textContent).toContain(
      '{"reason":"rate limit"}'
    );
  });

  it("uses the shared attribute viewer when an exception has no stack trace", async () => {
    await renderAttributes({
      name: "exception",
      attributes: { "exception.message": "division by zero" },
    });

    expect(container.querySelector("[data-testid='pre-block']")).toBeNull();
    expect(container.querySelector("table")?.textContent).toContain(
      "exception.message"
    );
  });
});
