import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SPAN_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";

const notificationMocks = vi.hoisted(() => ({
  notify: vi.fn(),
}));

vi.mock("@phoenix/contexts/NotificationContext", () => ({
  useNotify: () => notificationMocks.notify,
}));

import { LegacyTraceFilterParamNotice } from "../ProjectPage";

describe("LegacyTraceFilterParamNotice", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    notificationMocks.notify.mockReset();
    currentSearch = "";
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("notifies once and preserves the span filter for the spans tab", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            `/projects/project-1/traces?${SPAN_FILTER_CONDITION_PARAM}=status_code%20%3D%3D%20%27ERROR%27&selectedSpan=span-1`,
          ]}
        >
          <LegacyTraceFilterParamNotice isActive />
          <SearchProbe />
        </MemoryRouter>
      );
    });

    expect(notificationMocks.notify).toHaveBeenCalledTimes(1);
    expect(notificationMocks.notify).toHaveBeenCalledWith({
      title: "Traces now use trace-level filters",
      message:
        "The span-level filter from this link still applies on the Spans tab.",
    });
    expect(
      new URLSearchParams(currentSearch).get(SPAN_FILTER_CONDITION_PARAM)
    ).toBe("status_code == 'ERROR'");
    expect(new URLSearchParams(currentSearch).get("selectedSpan")).toBe(
      "span-1"
    );
  });
});

let currentSearch = "";
function SearchProbe() {
  currentSearch = useLocation().search;
  return null;
}
