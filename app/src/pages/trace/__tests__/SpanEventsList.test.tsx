import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { SpanEventsListContent } from "@phoenix/pages/trace/SpanEventsList";

vi.mock("@phoenix/pages/trace/ReadonlyJSONBlock", () => ({
  ReadonlyJSONBlock: ({ children }: { children: string }) => (
    <pre data-testid="readonly-json-block">{children}</pre>
  ),
}));

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

describe("SpanEventsListContent", () => {
  it("does not mount event attributes until the disclosure is expanded", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <SpanEventsListContent
            events={[
              {
                name: "event",
                message: "message",
                timestamp: "2025-01-01T00:00:00Z",
                attributes: { deferredValue: "only after expansion" },
              },
            ]}
          />
        </PreferencesProvider>
      );
    });

    expect(
      container.querySelector('[data-testid="readonly-json-block"]')
    ).toBeNull();

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    act(() => trigger?.click());

    expect(
      container.querySelector('[data-testid="readonly-json-block"]')
        ?.textContent
    ).toContain("only after expansion");
    expect(container.querySelector(".expandable-content")).not.toBeNull();
  });
});
