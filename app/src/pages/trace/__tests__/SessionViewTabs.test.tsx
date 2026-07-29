import { act, type ComponentProps, Suspense, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import {
  DetailsPanel,
  DetailsPanelContent,
  DetailsPanelContentBoundary,
} from "../DetailsPanel";
import { resetDetailsPanelSizingStoreForTesting } from "../detailsPanelSizing/store";
import { SessionDetailsNavigation } from "../SessionDetailsNavigation";
import { SessionDetailsPaginator } from "../SessionDetailsPaginator";
import { SessionDetailsSkeleton } from "../SessionDetailsSkeleton";
import { SessionPaginationContext } from "../SessionPaginationContext";
import { SessionViewControl, SessionViewTabs } from "../SessionViewTabs";

const detailsPanelNavigationRowContentPaddingInlineStart =
  "var(--global-details-panel-navigation-row-content-padding-inline-start)";
const sessionDetailsNavigationTopLevelRowPaddingBlock =
  "var(--global-session-details-navigation-top-level-row-padding-block)";

function normalizeCSSValue(value: string) {
  return value.replace(/\s/g, "");
}

type StatefulSessionDetailsNavigationProps = Omit<
  ComponentProps<typeof SessionDetailsNavigation>,
  "isPointerOpen" | "onPointerOpenChange"
>;

function StatefulSessionDetailsNavigation(
  props: StatefulSessionDetailsNavigationProps
) {
  const [isPointerOpen, setIsPointerOpen] = useState(false);
  return (
    <SessionDetailsNavigation
      {...props}
      isPointerOpen={isPointerOpen}
      onPointerOpenChange={setIsPointerOpen}
    />
  );
}

function dispatchPointerDown(element: Element) {
  const event =
    typeof PointerEvent === "function"
      ? new PointerEvent("pointerdown", { bubbles: true })
      : new MouseEvent("mousedown", { bubbles: true });
  element.dispatchEvent(event);
}

function SessionNavigationViewSwitchHarness() {
  const [sessionView, setSessionView] = useState<"turns" | "traces">("turns");
  const [isPointerOpen, setIsPointerOpen] = useState(false);
  return (
    <SessionDetailsNavigation
      key={sessionView}
      control={
        <SessionViewControl
          sessionView={sessionView}
          onSessionViewChange={setSessionView}
          traceCount={2}
        />
      }
      isCollapsed
      isPointerOpen={isPointerOpen}
      onPointerOpenChange={setIsPointerOpen}
    >
      <div>{sessionView === "turns" ? "Turn list" : "Trace list"}</div>
    </SessionDetailsNavigation>
  );
}

function SessionNavigationLoadingViewSwitchHarness() {
  const [sessionView, setSessionView] = useState<"turns" | "traces">("turns");
  const [isNavigationPointerOpen, setIsNavigationPointerOpen] = useState(false);
  const navigationProps = {
    isCollapsed: true,
    isPointerOpen: isNavigationPointerOpen,
    onPointerOpenChange: setIsNavigationPointerOpen,
  };

  return (
    <DetailsPanel
      preferredTreeWidth={320}
      onPreferredTreeWidthChange={() => {}}
      treeMaximumWidth={480}
    >
      {sessionView === "turns" ? (
        <DetailsPanelContent
          navigation={
            <SessionDetailsNavigation
              {...navigationProps}
              control={
                <SessionViewControl
                  sessionView={sessionView}
                  onSessionViewChange={setSessionView}
                  traceCount={2}
                />
              }
            >
              <div>Loaded turn list</div>
            </SessionDetailsNavigation>
          }
        >
          <div>Loaded turn details</div>
        </DetailsPanelContent>
      ) : (
        <SessionDetailsSkeleton
          isTreePanelCollapsed
          isNavigationPointerOpen={isNavigationPointerOpen}
          navigationHeader={<div>Header</div>}
          onNavigationPointerOpenChange={setIsNavigationPointerOpen}
          onSessionViewChange={setSessionView}
          onTreePanelCollapsedChange={() => {}}
          preview={{ sessionId: "session-node-id", traceCount: 2 }}
          sessionView={sessionView}
        />
      )}
    </DetailsPanel>
  );
}

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
                preferredTreeWidth={320}
                onPreferredTreeWidthChange={() => {}}
                treeMaximumWidth={480}
              >
                <DetailsPanelContent navigation={<div>Turns</div>}>
                  <div>Turn details</div>
                </DetailsPanelContent>
              </DetailsPanel>
            </SessionViewTabs>
          </ThemeContext.Provider>
        );
      });
    }).not.toThrow();

    const group = container.querySelector("[data-group]");
    expect(group?.ownerDocument.defaultView).toBe(window);
    const addComparisonButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Add comparison"]'
    );
    expect(addComparisonButton).not.toBeNull();
    expect(
      addComparisonButton?.closest(".details-panel-main-controls")
    ).not.toBeNull();
    expect(addComparisonButton?.getAttribute("data-variant")).toBe("quiet");
  });

  it("allows collapsed navigation to overlay the main panel through portal hosts", () => {
    act(() => {
      root.render(
        <DetailsPanel
          preferredTreeWidth={48}
          onPreferredTreeWidthChange={() => {}}
          treeMaximumWidth={480}
        >
          <DetailsPanelContent navigation={<div>Navigation</div>}>
            <div>Main content</div>
          </DetailsPanelContent>
        </DetailsPanel>
      );
    });

    const navigationContent = container.querySelector<HTMLElement>(
      ".details-panel-navigation-content"
    );
    const navigationHost = navigationContent?.parentElement;
    const mainContent = container.querySelector<HTMLElement>(
      ".details-panel-main-content"
    );
    const mainHost = mainContent?.parentElement;
    expect(navigationContent).not.toBeNull();
    expect(getComputedStyle(navigationHost!).overflow).toBe("visible");
    expect(getComputedStyle(navigationContent!).overflow).toBe("visible");
    expect(getComputedStyle(mainHost!).overflow).toBe("hidden");
    expect(getComputedStyle(mainContent!).overflow).toBe("hidden");
  });

  it("keeps both panel elements mounted while suspended content resolves", async () => {
    let isResolved = false;
    let resolveContent: () => void = () => {};
    const pendingContent = new Promise<void>((resolve) => {
      resolveContent = resolve;
    });

    function DelayedContent() {
      if (!isResolved) throw pendingContent;
      return (
        <DetailsPanelContent navigation={<div>Resolved navigation</div>}>
          <div>Resolved details</div>
        </DetailsPanelContent>
      );
    }

    act(() => {
      root.render(
        <DetailsPanel
          preferredTreeWidth={320}
          onPreferredTreeWidthChange={() => {}}
          treeMaximumWidth={480}
        >
          <Suspense
            fallback={
              <DetailsPanelContent navigation={<div>Loading navigation</div>}>
                <div>Loading details</div>
              </DetailsPanelContent>
            }
          >
            <DelayedContent />
          </Suspense>
        </DetailsPanel>
      );
    });

    const groupBeforeResolution = container.querySelector("[data-group]");
    const panelsBeforeResolution = Array.from(
      container.querySelectorAll("[data-panel]")
    );
    expect(panelsBeforeResolution).toHaveLength(2);
    expect(container.textContent).toContain("Loading navigation");
    expect(container.textContent).toContain("Loading details");

    await act(async () => {
      isResolved = true;
      resolveContent();
      await pendingContent;
    });

    expect(container.querySelector("[data-group]")).toBe(groupBeforeResolution);
    expect(Array.from(container.querySelectorAll("[data-panel]"))).toEqual(
      panelsBeforeResolution
    );
    expect(container.textContent).toContain("Resolved navigation");
    expect(container.textContent).toContain("Resolved details");
  });

  it("shows the next subject fallback without remounting either panel", async () => {
    let isNextSubjectResolved = false;
    let resolveNextSubject: () => void = () => {};
    const pendingNextSubject = new Promise<void>((resolve) => {
      resolveNextSubject = resolve;
    });

    function SubjectContent({ subject }: { subject: string }) {
      if (subject === "next" && !isNextSubjectResolved) {
        throw pendingNextSubject;
      }
      return (
        <DetailsPanelContent navigation={<div>{subject} navigation</div>}>
          <div>{subject} details</div>
        </DetailsPanelContent>
      );
    }

    const renderSubject = (subject: string) => {
      root.render(
        <DetailsPanel
          preferredTreeWidth={320}
          onPreferredTreeWidthChange={() => {}}
          treeMaximumWidth={480}
        >
          <DetailsPanelContentBoundary
            subjectKey={subject}
            navigation={<div>{subject} error navigation</div>}
            fallback={
              <DetailsPanelContent navigation={<div>Loading navigation</div>}>
                <div>Loading details</div>
              </DetailsPanelContent>
            }
          >
            <SubjectContent subject={subject} />
          </DetailsPanelContentBoundary>
        </DetailsPanel>
      );
    };

    act(() => renderSubject("current"));
    const group = container.querySelector("[data-group]");
    const panels = Array.from(container.querySelectorAll("[data-panel]"));
    expect(container.textContent).toContain("current details");

    act(() => renderSubject("next"));
    expect(container.querySelector("[data-group]")).toBe(group);
    expect(Array.from(container.querySelectorAll("[data-panel]"))).toEqual(
      panels
    );
    expect(container.textContent).not.toContain("current details");
    expect(container.textContent).toContain("Loading navigation");
    expect(container.textContent).toContain("Loading details");

    await act(async () => {
      isNextSubjectResolved = true;
      resolveNextSubject();
      await pendingNextSubject;
    });

    expect(container.querySelector("[data-group]")).toBe(group);
    expect(Array.from(container.querySelectorAll("[data-panel]"))).toEqual(
      panels
    );
    expect(container.textContent).toContain("next navigation");
    expect(container.textContent).toContain("next details");
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
          <StatefulSessionDetailsNavigation
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
          </StatefulSessionDetailsNavigation>
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
    expect(normalizeCSSValue(getComputedStyle(compactIndex!).top)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(compactIndex!).left)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
    expect(normalizeCSSValue(getComputedStyle(compactTraceIndex!).top)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(compactTraceIndex!).left)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
    expect(getComputedStyle(compactIndex!).textAlign).toBe("left");
    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
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
    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
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

  it("does not latch a hovered navigation open after a pointer-focused tree action", () => {
    act(() => {
      root.render(
        <>
          <StatefulSessionDetailsNavigation
            isCollapsed
            control={<div>View control</div>}
          >
            <button type="button">Expand subtree</button>
          </StatefulSessionDetailsNavigation>
          <button type="button">Outside action</button>
        </>
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
    const expandButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Expand subtree"
    );
    const outsideButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Outside action"
    );

    act(() => {
      body?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    expect(navigation?.dataset.open).toBe("true");

    act(() => {
      if (expandButton) {
        dispatchPointerDown(expandButton);
        expandButton.focus();
      }
    });
    expect(document.activeElement).toBe(expandButton);

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
      if (outsideButton) {
        dispatchPointerDown(outsideButton);
        outsideButton.focus();
      }
    });
    expect(navigation?.dataset.open).toBe("false");
  });

  it("keeps collapsed navigation available to keyboard focus", () => {
    act(() => {
      root.render(
        <>
          <StatefulSessionDetailsNavigation
            isCollapsed
            control={<div>View control</div>}
          >
            <button type="button">Keyboard tree action</button>
          </StatefulSessionDetailsNavigation>
          <button type="button">Outside action</button>
        </>
      );
    });

    const navigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    const treeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Keyboard tree action"
    );
    const outsideButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Outside action"
    );

    act(() => {
      treeButton?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Tab" })
      );
      treeButton?.focus();
    });
    expect(navigation?.dataset.open).toBe("true");

    act(() => outsideButton?.focus());
    expect(navigation?.dataset.open).toBe("false");
  });

  it("aligns turn and trace row content in the open navigation", () => {
    act(() => {
      root.render(
        <SessionDetailsNavigation
          control={<div>View control</div>}
          isCollapsed={false}
          isPointerOpen={false}
          onPointerOpenChange={() => {}}
        >
          <button type="button" className="session-turn-row">
            Turn
          </button>
          <button type="button" className="session-trace-row-header">
            Trace
          </button>
        </SessionDetailsNavigation>
      );
    });

    const turnRow = container.querySelector<HTMLElement>(".session-turn-row");
    const traceRow = container.querySelector<HTMLElement>(
      ".session-trace-row-header"
    );

    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingTop)).toBe(
      sessionDetailsNavigationTopLevelRowPaddingBlock
    );
    expect(normalizeCSSValue(getComputedStyle(turnRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
    expect(normalizeCSSValue(getComputedStyle(traceRow!).paddingLeft)).toBe(
      detailsPanelNavigationRowContentPaddingInlineStart
    );
  });

  it("keeps the hover navigation open when switching session views", () => {
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
          <SessionNavigationViewSwitchHarness />
        </ThemeContext.Provider>
      );
    });

    const body = container.querySelector<HTMLElement>(
      ".session-details-navigation__body"
    );
    act(() => {
      body?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });

    const initialNavigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    expect(initialNavigation?.dataset.open).toBe("true");

    const tracesSegment = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((button) => button.textContent?.includes("Traces"));
    act(() => tracesSegment?.click());

    const nextNavigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    expect(nextNavigation).not.toBe(initialNavigation);
    expect(nextNavigation?.dataset.open).toBe("true");
    expect(nextNavigation?.textContent).toContain("Trace list");

    const nextContent = container.querySelector<HTMLElement>(
      ".session-details-navigation__content"
    );
    act(() => {
      nextContent?.dispatchEvent(
        new MouseEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
    });
    expect(nextNavigation?.dataset.open).toBe("false");
  });

  it("keeps the hovered column width while an unseen session view loads", () => {
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
          <SessionNavigationLoadingViewSwitchHarness />
        </ThemeContext.Provider>
      );
    });

    const loadedBody = container.querySelector<HTMLElement>(
      ".session-details-navigation__body"
    );
    act(() => {
      loadedBody?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true })
      );
    });

    const loadedNavigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    const loadedContent = container.querySelector<HTMLElement>(
      ".session-details-navigation__content"
    );
    expect(loadedNavigation?.dataset.open).toBe("true");
    expect(getComputedStyle(loadedContent!).width).toBe(
      "var(--trace-tree-overlay-width)"
    );

    const tracesSegment = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((button) => button.textContent?.includes("Traces"));
    act(() => tracesSegment?.click());

    const loadingNavigation = container.querySelector<HTMLElement>(
      ".session-details-navigation"
    );
    const loadingContent = container.querySelector<HTMLElement>(
      ".session-details-navigation__content"
    );
    expect(container.textContent).not.toContain("Loaded turn details");
    expect(
      container.querySelector('[data-testid="session-navigation-skeleton"]')
    ).not.toBeNull();
    expect(loadingNavigation).not.toBe(loadedNavigation);
    expect(loadingNavigation?.dataset.open).toBe("true");
    expect(getComputedStyle(loadingContent!).width).toBe(
      getComputedStyle(loadedContent!).width
    );
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
          <StatefulSessionDetailsNavigation
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
          </StatefulSessionDetailsNavigation>
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

  it("keeps the session shell and target preview visible while details load", () => {
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
          <DetailsPanel
            preferredTreeWidth={320}
            onPreferredTreeWidthChange={() => {}}
            treeMaximumWidth={480}
          >
            <SessionDetailsSkeleton
              isTreePanelCollapsed={false}
              isNavigationPointerOpen={false}
              navigationHeader={<div data-testid="stable-header">Header</div>}
              onNavigationPointerOpenChange={() => {}}
              onSessionViewChange={() => {}}
              onTreePanelCollapsedChange={() => {}}
              preview={{
                sessionId: "session-node-id",
                sessionDisplayId: "customer-session-id",
                traceCount: 4,
                tokenCountTotal: 120,
                totalCost: 0.25,
              }}
              sessionView="turns"
            />
          </DetailsPanel>
        </ThemeContext.Provider>
      );
    });

    expect(
      container.querySelector('[data-testid="stable-header"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Session view"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="session-navigation-skeleton"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Session");
    expect(
      container.querySelector(
        '[aria-label="Copy Session ID customer-session-id"]'
      )
    ).not.toBeNull();
    expect(container.textContent).toContain("4");
  });
});
