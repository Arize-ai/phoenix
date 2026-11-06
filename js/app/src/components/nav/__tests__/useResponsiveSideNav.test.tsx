import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { SideNavToggleButton } from "../SideNavToggleButton";
import {
  SIDE_NAV_EXPANSION_MEDIA_QUERY,
  useResponsiveSideNav,
} from "../useResponsiveSideNav";

let container: HTMLDivElement;
let root: Root;
let isMediaQueryMatched = true;
let originalMatchMedia: typeof window.matchMedia;
const mediaQueryListeners = new Set<() => void>();

function ResponsiveSideNavState() {
  const { isSideNavExpanded, isSideNavExpansionAllowed } =
    useResponsiveSideNav();

  return (
    <output
      data-expanded={isSideNavExpanded}
      data-expansion-allowed={isSideNavExpansionAllowed}
    />
  );
}

function setMediaQueryMatched(isMatched: boolean) {
  isMediaQueryMatched = isMatched;
  act(() => {
    mediaQueryListeners.forEach((listener) => listener());
  });
}

beforeEach(() => {
  localStorage.clear();
  isMediaQueryMatched = true;
  mediaQueryListeners.clear();
  originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMediaQueryMatched,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        mediaQueryListeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        mediaQueryListeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

async function renderResponsiveSideNavState({
  isSideNavExpanded = true,
}: {
  isSideNavExpanded?: boolean;
} = {}) {
  await act(async () => {
    root.render(
      <PreferencesProvider isSideNavExpanded={isSideNavExpanded}>
        <ResponsiveSideNavState />
      </PreferencesProvider>
    );
  });
  return container.querySelector("output");
}

describe("useResponsiveSideNav", () => {
  it("temporarily collapses an expanded nav below the responsive breakpoint", async () => {
    const output = await renderResponsiveSideNavState();

    expect(window.matchMedia).toHaveBeenCalledWith(
      SIDE_NAV_EXPANSION_MEDIA_QUERY
    );
    expect(output?.dataset.expanded).toBe("true");
    expect(output?.dataset.expansionAllowed).toBe("true");

    setMediaQueryMatched(false);

    expect(output?.dataset.expanded).toBe("false");
    expect(output?.dataset.expansionAllowed).toBe("false");

    setMediaQueryMatched(true);

    expect(output?.dataset.expanded).toBe("true");
    expect(output?.dataset.expansionAllowed).toBe("true");
  });

  it("keeps a user-collapsed nav collapsed on a wide viewport", async () => {
    const output = await renderResponsiveSideNavState({
      isSideNavExpanded: false,
    });

    expect(output?.dataset.expanded).toBe("false");
    expect(output?.dataset.expansionAllowed).toBe("true");
  });
});

describe("SideNavToggleButton", () => {
  it("does not allow expansion when the responsive layout disables it", async () => {
    const onExpandedChange = vi.fn();
    await act(async () => {
      root.render(
        <SideNavToggleButton
          isExpanded={false}
          isDisabled={true}
          onExpandedChange={onExpandedChange}
        />
      );
    });
    const button = container.querySelector("button");

    expect(button?.getAttribute("aria-label")).toBe("Expand side navigation");
    expect(button?.disabled).toBe(true);

    act(() => button?.click());

    expect(onExpandedChange).not.toHaveBeenCalled();
  });
});
