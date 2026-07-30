import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SessionDetailsHeader } from "../SessionDetailsHeader";

describe("SessionDetailsHeader", () => {
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

  it("places the icon-only ID beside the title and annotations after metadata", () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider>
            <SessionDetailsHeader
              annotationBar={
                <div data-testid="session-annotation-bar">Annotations</div>
              }
              preview={{
                sessionId: "session-node-id",
                sessionDisplayId: "session-display-id",
                tokenCountTotal: 0,
                totalCost: 0,
              }}
            />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });

    const detailHeader = container.querySelector("[data-detail-header]");
    const title = detailHeader?.querySelector(".detail-header__title");
    const copyIdButton = detailHeader?.querySelector(
      '[aria-label="Copy Session ID session-display-id"]'
    );
    expect(
      title?.previousElementSibling?.classList.contains(
        "detail-header-status-indicator"
      )
    ).toBe(true);
    expect(title?.nextElementSibling).toBe(copyIdButton);
    expect(title?.previousElementSibling?.getAttribute("style")).toContain(
      "--detail-header-status-indicator-color: var(--global-color-gray-200)"
    );
    expect(
      detailHeader?.querySelector(".detail-header__meta-item")?.textContent
    ).toBe("session");
    const sessionIcon = detailHeader?.querySelector(
      '.detail-header__meta-item [data-core-icon="true"]'
    );
    expect(sessionIcon).not.toBeNull();
    expect(sessionIcon?.getAttribute("style")).toContain(
      "--span-kind-icon-color: var(--global-color-gray-100)"
    );
    expect(getComputedStyle(copyIdButton!).alignSelf).toBe("center");
    expect(getComputedStyle(copyIdButton!.parentElement!).alignItems).toBe(
      "center"
    );
    expect(detailHeader?.textContent).not.toContain("session-display-id");
    expect(
      detailHeader?.querySelector("[data-testid='session-annotation-bar']")
    ).not.toBeNull();
  });
});
