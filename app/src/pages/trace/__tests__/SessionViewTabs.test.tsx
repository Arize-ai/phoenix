import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { DetailsPanel } from "../DetailsPanel";
import { resetDetailsPanelSizingStoreForTesting } from "../detailsPanelSizing/store";
import { SessionDetailsNavigation } from "../SessionDetailsNavigation";
import { SessionDetailsPaginator } from "../SessionDetailsPaginator";
import { SessionPaginationContext } from "../SessionPaginationContext";
import { SessionViewControl, SessionViewTabs } from "../SessionViewTabs";

describe("SessionViewTabs", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.ResizeObserver = originalResizeObserver;
    resetDetailsPanelSizingStoreForTesting();
    vi.restoreAllMocks();
  });

  it("renders a resizable details panel in the mounted document", () => {
    expect(() => {
      act(() => {
        root.render(
          <ThemeContext.Provider
            value={{
              theme: "light",
              systemTheme: "light",
              themeMode: "light",
              setThemeMode: vi.fn(),
            }}
          >
            <SessionViewTabs
              sessionView="turns"
              onSessionViewChange={() => {}}
              traceCount={2}
            >
              <DetailsPanel
                navigation={<div>Turns</div>}
                preferredTreeWidth={320}
                onPreferredTreeWidthChange={() => {}}
                treeMaximumWidth={480}
              >
                <div>Turn details</div>
              </DetailsPanel>
            </SessionViewTabs>
          </ThemeContext.Provider>
        );
      });
    }).not.toThrow();

    const group = container.querySelector("[data-group]");
    expect(group?.ownerDocument.defaultView).toBe(window);
  });

  it("reveals the full session navigation over a height-preserving rail", () => {
    const onSessionViewChange = vi.fn();

    act(() => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            systemTheme: "light",
            themeMode: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <SessionDetailsNavigation
            isCollapsed
            control={
              <SessionViewControl
                sessionView="turns"
                onSessionViewChange={onSessionViewChange}
                traceCount={2}
              />
            }
          >
            {({ isOverlayOpen }) => (
              <>
                <button type="button" className="session-turn-row">
                  <span className="session-turn-row__compact-index">01</span>
                  <span className="session-turn-row__expanded-content">
                    Full turn content
                  </span>
                </button>
                <button type="button" className="session-trace-row-header">
                  <span className="session-trace-row-header__compact-index">
                    01
                  </span>
                  <span className="session-trace-row-header__expanded-content">
                    Full trace content
                  </span>
                </button>
                <div
                  className="session-trace-tree"
                  data-navigation-mode={isOverlayOpen ? "full" : "compact"}
                >
                  Trace tree
                </div>
              </>
            )}
          </SessionDetailsNavigation>
        </ThemeContext.Provider>
      );
    });

    const navigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    const content = container.querySelector<HTMLElement>(
      ".session-details-navigation__content"
    );
    const body = container.querySelector<HTMLElement>(
      ".session-details-navigation__body"
    );
    const compactControl = container.querySelector<HTMLElement>(
      ".session-view-control__compact"
    );
    const expandedControl = container.querySelector<HTMLElement>(
      ".session-view-control__expanded"
    );
    const compactIndex = container.querySelector<HTMLElement>(
      ".session-turn-row__compact-index"
    );
    const compactTraceIndex = container.querySelector<HTMLElement>(
      ".session-trace-row-header__compact-index"
    );
    const turnRow = container.querySelector<HTMLElement>(".session-turn-row");
    const traceRow = container.querySelector<HTMLElement>(
      ".session-trace-row-header"
    );
    const expandedTurnContent = container.querySelector<HTMLElement>(
      ".session-turn-row__expanded-content"
    );
    const traceTree = container.querySelector<HTMLElement>(
      ".session-trace-tree"
    );
    const switchViewButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch to traces view"]'
    );

    expect(navigation?.dataset.open).toBe("false");
    expect(getComputedStyle(navigation!).overflow).toBe("hidden");
    expect(getComputedStyle(content!).minWidth).toBe(
      "var(--trace-tree-overlay-width)"
    );
    expect(getComputedStyle(compactControl!).display).toBe("flex");
    expect(getComputedStyle(expandedControl!).display).toBe("none");
    expect(getComputedStyle(compactIndex!).display).toBe("inline-flex");
    expect(getComputedStyle(compactIndex!).top).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(compactIndex!).left).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(compactTraceIndex!).top).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(compactTraceIndex!).left).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(compactIndex!).textAlign).toBe("left");
    expect(getComputedStyle(turnRow!).paddingTop).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(turnRow!).paddingLeft).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(traceRow!).paddingTop).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(traceRow!).paddingLeft).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(expandedTurnContent!).display).not.toBe("none");
    expect(getComputedStyle(expandedTurnContent!).visibility).toBe("hidden");
    expect(traceTree?.dataset.navigationMode).toBe("compact");
    expect(getComputedStyle(traceTree!).visibility).toBe("visible");

    act(() => switchViewButton?.click());
    expect(onSessionViewChange).toHaveBeenCalledWith("traces");

    act(() => {
      body?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });

    expect(navigation?.dataset.open).toBe("true");
    expect(getComputedStyle(navigation!).overflow).toBe("visible");
    expect(content?.dataset.open).toBe("true");
    expect(getComputedStyle(compactControl!).display).toBe("none");
    expect(getComputedStyle(expandedControl!).display).not.toBe("none");
    expect(getComputedStyle(compactIndex!).display).toBe("none");
    expect(getComputedStyle(expandedTurnContent!).visibility).toBe("visible");
    expect(traceTree?.dataset.navigationMode).toBe("full");
    expect(getComputedStyle(content!).boxShadow).toContain("8px 16px");
    expect(getComputedStyle(turnRow!).paddingTop).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(turnRow!).paddingLeft).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(traceRow!).paddingTop).toBe(
      "var(--global-dimension-size-150)"
    );
    expect(getComputedStyle(traceRow!).paddingLeft).toBe(
      "var(--global-dimension-size-150)"
    );

    act(() => {
      content?.dispatchEvent(
        new MouseEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
    });

    expect(navigation?.dataset.open).toBe("false");

    act(() => {
      body?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });

    expect(navigation?.dataset.open).toBe("true");
  });

  it("offers the inactive view from the compact switcher", () => {
    const onSessionViewChange = vi.fn();

    act(() => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            systemTheme: "light",
            themeMode: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <SessionDetailsNavigation
            isCollapsed
            control={
              <SessionViewControl
                sessionView="traces"
                onSessionViewChange={onSessionViewChange}
                traceCount={2}
              />
            }
          >
            <div>Trace list</div>
          </SessionDetailsNavigation>
        </ThemeContext.Provider>
      );
    });

    const switchViewButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch to turns view"]'
    );
    expect(switchViewButton).not.toBeNull();

    act(() => switchViewButton?.click());
    expect(onSessionViewChange).toHaveBeenCalledWith("turns");
  });

  it("stacks session pagination controls only in the collapsed column", () => {
    const pagination = {
      sessionSequence: [
        { sessionId: "previous" },
        { sessionId: "current" },
        { sessionId: "next" },
      ],
      next: vi.fn(),
      previous: vi.fn(),
      setSessionSequence: vi.fn(),
    };

    const renderPaginator = (isCollapsed: boolean) => {
      act(() => {
        root.render(
          <ThemeContext.Provider
            value={{
              theme: "light",
              systemTheme: "light",
              themeMode: "light",
              setThemeMode: vi.fn(),
            }}
          >
            <SessionPaginationContext.Provider value={pagination}>
              <SessionDetailsPaginator
                currentId="current"
                isCollapsed={isCollapsed}
              />
            </SessionPaginationContext.Provider>
          </ThemeContext.Provider>
        );
      });
    };

    renderPaginator(true);
    const buttons = container.querySelector<HTMLElement>(
      ".session-details-paginator__buttons"
    );
    expect(getComputedStyle(buttons!).flexDirection).toBe("column");

    renderPaginator(false);
    expect(getComputedStyle(buttons!).flexDirection).toBe("row");
  });
});
