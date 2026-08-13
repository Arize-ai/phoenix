import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("notifies once and removes only the legacy traces filter", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/projects/project-1/traces?filterCondition=status_code%20%3D%3D%20%27ERROR%27&selectedSpan=span-1",
          ]}
        >
          <LegacyTraceFilterParamNotice isActive />
          <SearchProbe />
        </MemoryRouter>
      );
    });

    expect(notificationMocks.notify).toHaveBeenCalledTimes(1);
    expect(notificationMocks.notify).toHaveBeenCalledWith({
      title: "Span filter not applied",
      message:
        "This link's span filter no longer applies to the Traces tab. Showing all traces.",
    });
    expect(currentSearch).toBe("?selectedSpan=span-1");
  });
});

let currentSearch = "";
function SearchProbe() {
  currentSearch = useLocation().search;
  return null;
}
