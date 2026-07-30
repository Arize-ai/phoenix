import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  TraceTree,
  TraceTreeProvider,
  type TraceTreeProps,
} from "../TraceTree";
import { TraceTreeContext } from "../TraceTreeContext";
import type { ISpanItem } from "../types";

const ROOT_SPAN: ISpanItem = {
  id: "span-node-id",
  name: "root span",
  spanKind: "chain",
  statusCode: "OK",
  latencyMs: 100,
  startTime: "2026-07-26T12:00:00.000Z",
  endTime: "2026-07-26T12:00:00.100Z",
  parentId: null,
  spanId: "span-id",
};

const CHILD_SPAN: ISpanItem = {
  ...ROOT_SPAN,
  id: "child-span-node-id",
  name: "child span",
  parentId: ROOT_SPAN.spanId,
  spanId: "child-span-id",
};

const GRANDCHILD_SPAN: ISpanItem = {
  ...ROOT_SPAN,
  id: "grandchild-span-node-id",
  name: "grandchild span with a much longer name",
  latencyMs: null,
  parentId: CHILD_SPAN.spanId,
  spanId: "grandchild-span-id",
};

function createTestSpan({
  nodeId,
  parent,
  startOffsetMs,
}: {
  nodeId: string;
  parent: ISpanItem;
  startOffsetMs: number;
}): ISpanItem {
  const startTime = new Date(
    new Date(ROOT_SPAN.startTime).getTime() + startOffsetMs
  ).toISOString();
  return {
    ...ROOT_SPAN,
    id: nodeId,
    name: nodeId,
    parentId: parent.spanId,
    spanId: `${nodeId}-span-id`,
    startTime,
  };
}

describe("TraceTree", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderTraceTree({
    spans,
    selectedSpanNodeId = "",
    onSpanClick,
    onSpanSelectionStart,
    renderSpanActions,
    searchQuery,
    isChildTruncationEnabled = false,
    isHoverOverlayEnabled = true,
    isNavigationCollapsed = false,
    session,
    traceSelection,
  }: {
    spans: ISpanItem[];
    selectedSpanNodeId?: string;
    onSpanClick?: (span: ISpanItem) => void;
    onSpanSelectionStart?: (span: ISpanItem) => void;
    renderSpanActions?: TraceTreeProps["renderSpanActions"];
    searchQuery?: string;
    isChildTruncationEnabled?: boolean;
    isHoverOverlayEnabled?: boolean;
    isNavigationCollapsed?: boolean;
    session?: TraceTreeProps["session"];
    traceSelection?: TraceTreeProps["traceSelection"];
  }) {
    const traceTree = (
      <TraceTree
        spans={spans}
        isChildTruncationEnabled={isChildTruncationEnabled}
        isHoverOverlayEnabled={isHoverOverlayEnabled}
        isNavigationCollapsed={isNavigationCollapsed}
        session={session}
        traceSelection={traceSelection}
        selectedSpanNodeId={selectedSpanNodeId}
        scrollSelectedSpanIntoView={false}
        onSpanClick={onSpanClick}
        onSpanSelectionStart={onSpanSelectionStart}
        renderSpanActions={renderSpanActions}
      />
    );
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              {searchQuery === undefined ? (
                <TraceTreeProvider>{traceTree}</TraceTreeProvider>
              ) : (
                <TraceTreeContext.Provider
                  value={{
                    isCollapsed: false,
                    setIsCollapsed: vi.fn(),
                    searchQuery,
                    setSearchQuery: vi.fn(),
                  }}
                >
                  {traceTree}
                </TraceTreeContext.Provider>
              )}
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });
  }

  it("renders a text-free icon rail and a separate full-tree overlay", () => {
    renderTraceTree({
      spans: [ROOT_SPAN, CHILD_SPAN],
      selectedSpanNodeId: ROOT_SPAN.id,
      isNavigationCollapsed: true,
      session: {
        sessionId: "session-12345678",
        to: "/projects/project-1/sessions/session-node-id",
      },
      traceSelection: {
        isSelected: false,
        onSelect: vi.fn(),
        traceId: "trace-12345678",
      },
    });

    const navigation = container.querySelector(".trace-tree-navigation");
    const rail = container.querySelector(
      '[data-testid="trace-tree-icon-rail"]'
    );
    const overlay = container.querySelector(".trace-tree-navigation__overlay");
    const fullTree = overlay?.querySelector('[data-testid="trace-tree"]');
    const rootSpanName =
      fullTree?.querySelector<HTMLElement>(".span-tree-name");
    const rootSpanRow = fullTree?.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const compactRootSpanRow = rail?.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );

    expect(rail).not.toBeNull();
    expect(overlay).not.toBeNull();
    if (overlay === null) {
      throw new Error("Expected the trace tree overlay to render");
    }
    const overlayStyle = getComputedStyle(overlay);
    const railClassName = Array.from(rail?.classList ?? []).find((className) =>
      className.startsWith("css-")
    );
    const railItemStyleRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === `.${railClassName} .trace-tree-icon-rail__item`
      );
    expect(rail?.textContent).toBe("");
    expect(
      Array.from(rail?.querySelectorAll("a, button") ?? []).map((action) =>
        action.getAttribute("aria-label")
      )
    ).toEqual([
      "View session session-12345678",
      "View trace trace-12345678",
      "View span root span",
      "View span child span",
    ]);
    expect(fullTree?.textContent).toContain("root span");
    expect(fullTree?.textContent).toContain("child span");
    expect(overlayStyle.height).toBe("fit-content");
    expect(overlayStyle.maxHeight).toBe("100%");
    expect(overlayStyle.position).toBe("static");
    expect(overlayStyle.visibility).toBe("hidden");
    expect(getComputedStyle(rail!).position).toBe("absolute");
    expect(getComputedStyle(rail!).overflowY).toBe("auto");
    expect(getComputedStyle(rail!).scrollbarWidth).toBe("none");
    expect(railItemStyleRule?.style.padding).toBe(
      "0 0 0 var(--global-details-panel-navigation-row-content-padding-inline-start)"
    );
    expect(getComputedStyle(rootSpanName!).paddingLeft).toContain(
      "--global-details-panel-navigation-row-content-padding-inline-start"
    );
    expect(railItemStyleRule?.style.borderLeft).toBe("3px solid transparent");
    expect(getComputedStyle(rootSpanRow!).height).toBe(
      "var(--global-details-panel-navigation-row-height)"
    );
    expect(getComputedStyle(compactRootSpanRow!).height).toBe(
      "var(--global-details-panel-navigation-row-height)"
    );
    expect(overlay.getAttribute("data-open")).toBe("false");
    expect(overlay.hasAttribute("inert")).toBe(true);

    act(() => {
      navigation?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true })
      );
    });

    expect(overlay.getAttribute("data-open")).toBe("true");
    expect(overlay.hasAttribute("inert")).toBe(false);
    expect(rail?.getAttribute("aria-hidden")).toBe("true");
    const openOverlayStyle = getComputedStyle(overlay);
    expect(openOverlayStyle.position).toBe("absolute");
    expect(openOverlayStyle.paddingBottom).toBe(
      "var(--global-dimension-size-100)"
    );
    expect(openOverlayStyle.borderRadius).toBe("var(--global-rounding-small)");
    expect(openOverlayStyle.boxShadow).toContain("8px 16px");
    expect(getComputedStyle(rail!).visibility).toBe("hidden");
    expect(getComputedStyle(rootSpanRow!).height).toBe(
      "var(--global-details-panel-navigation-row-height)"
    );
  });

  it("uses the list-item hover background for every trace-tree row", () => {
    renderTraceTree({
      spans: [ROOT_SPAN, CHILD_SPAN],
      isNavigationCollapsed: true,
      session: {
        sessionId: "session-12345678",
        to: "/projects/project-1/sessions/session-node-id",
      },
      traceSelection: {
        isSelected: false,
        onSelect: vi.fn(),
        traceId: "trace-12345678",
      },
    });

    const iconRail = container.querySelector<HTMLElement>(
      '[data-testid="trace-tree-icon-rail"]'
    );
    const traceEntityRow = container.querySelector<HTMLButtonElement>(
      '.trace-tree-navigation__full button[aria-label="View trace trace-12345678"]'
    )?.parentElement;
    const spanRow = container.querySelector<HTMLElement>(
      `.trace-tree-navigation__full [data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const getGeneratedClassName = (
      element: Element | null | undefined
    ): string => {
      const className = Array.from(element?.classList ?? []).find((item) =>
        item.startsWith("css-")
      );
      if (!className) throw new Error("Expected an Emotion class name");
      return className;
    };
    const iconRailClassName = getGeneratedClassName(iconRail);
    const traceEntityClassName = getGeneratedClassName(traceEntityRow);
    const spanRowClassName = getGeneratedClassName(spanRow);
    const styleRules = Array.from(document.styleSheets).flatMap((styleSheet) =>
      Array.from(styleSheet.cssRules)
    );
    const hoverBackgrounds = [
      `.${iconRailClassName} .trace-tree-icon-rail__item:hover`,
      `.${traceEntityClassName}:hover`,
      `.${spanRowClassName}:hover`,
    ].map((selectorText) => {
      const styleRule = styleRules.find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && rule.selectorText === selectorText
      );
      return styleRule?.style.backgroundColor;
    });

    expect(hoverBackgrounds).toEqual([
      "var(--global-list-item-hover-background-color)",
      "var(--global-list-item-hover-background-color)",
      "var(--global-list-item-hover-background-color)",
    ]);
  });

  it("synchronizes compact and hover-overlay scroll positions", () => {
    renderTraceTree({
      spans: [ROOT_SPAN, CHILD_SPAN, GRANDCHILD_SPAN],
      isNavigationCollapsed: true,
    });

    const navigation = container.querySelector<HTMLElement>(
      ".trace-tree-navigation"
    );
    const rail = container.querySelector<HTMLElement>(
      '[data-testid="trace-tree-icon-rail"]'
    );
    const fullTree = container.querySelector<HTMLElement>(
      '.trace-tree-navigation__overlay [data-testid="trace-tree"]'
    );
    if (!navigation || !rail || !fullTree) {
      throw new Error("Expected collapsed trace navigation");
    }

    rail.scrollTop = 72;
    act(() => {
      navigation.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true })
      );
    });
    expect(fullTree.scrollTop).toBe(72);

    fullTree.scrollTop = 144;
    act(() => {
      navigation.dispatchEvent(
        new MouseEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
    });
    expect(rail.scrollTop).toBe(144);
  });

  it("colors the selected error span's row marker red", () => {
    const errorSpan: ISpanItem = {
      ...ROOT_SPAN,
      statusCode: "ERROR",
    };
    renderTraceTree({
      spans: [errorSpan],
      selectedSpanNodeId: errorSpan.id,
      isNavigationCollapsed: true,
    });

    const rail = container.querySelector<HTMLElement>(
      '[data-testid="trace-tree-icon-rail"]'
    );
    const compactRow = rail?.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${errorSpan.id}"]`
    );
    const fullRow = container.querySelector<HTMLElement>(
      `.trace-tree-navigation__overlay [data-trace-tree-span-node-id="${errorSpan.id}"]`
    );
    const railClassName = Array.from(rail?.classList ?? []).find((className) =>
      className.startsWith("css-")
    );
    const fullRowClassName = Array.from(fullRow?.classList ?? []).find(
      (className) => className.startsWith("css-")
    );
    const styleRules = Array.from(document.styleSheets).flatMap((styleSheet) =>
      Array.from(styleSheet.cssRules)
    );
    const compactErrorRule = styleRules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes(`.${railClassName} `) &&
        rule.selectorText.includes('[data-status-code="ERROR"]')
    );
    const fullErrorRule = styleRules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes(`.${fullRowClassName}.is-selected`) &&
        rule.selectorText.includes('[data-status-code="ERROR"]')
    );
    const fullErrorTextRule = styleRules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes(
          `.${fullRowClassName}[data-status-code="ERROR"]`
        ) &&
        rule.selectorText.includes(".span-tree-name__label")
    );

    expect(compactRow?.dataset.statusCode).toBe("ERROR");
    expect(fullRow?.dataset.statusCode).toBe("ERROR");
    expect(compactErrorRule?.style.borderLeftColor).toBe(
      "var(--global-color-danger)"
    );
    expect(fullErrorRule?.style.borderLeftColor).toBe(
      "var(--global-color-danger)"
    );
    expect(fullErrorTextRule?.style.color).toBe("var(--global-color-red-1000)");
  });

  it("preserves span disclosure state while switching between full and compact navigation", () => {
    const renderNavigation = (isNavigationCollapsed: boolean) =>
      renderTraceTree({
        spans: [ROOT_SPAN, CHILD_SPAN],
        isNavigationCollapsed,
      });
    const getFullTreeChildList = () =>
      container
        .querySelector(
          `.trace-tree-navigation__full [data-trace-tree-span-node-id="${CHILD_SPAN.id}"]`
        )
        ?.closest("ul");

    renderNavigation(false);
    const rootSpan = container.querySelector(
      `.trace-tree-navigation__full [data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const collapseButton = rootSpan?.parentElement?.querySelector(
      ".collapse-toggle-button"
    );
    act(() => {
      collapseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getComputedStyle(getFullTreeChildList()!).display).toBe("none");

    renderNavigation(true);
    expect(getComputedStyle(getFullTreeChildList()!).display).toBe("none");
    expect(
      Array.from(
        container.querySelectorAll(
          '[data-testid="trace-tree-icon-rail"] a, [data-testid="trace-tree-icon-rail"] button'
        )
      ).map((action) => action.getAttribute("aria-label"))
    ).toEqual(["View span root span"]);

    const navigation = container.querySelector(".trace-tree-navigation");
    act(() => {
      navigation?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true })
      );
    });
    expect(
      container
        .querySelector(".trace-tree-navigation__full")
        ?.getAttribute("data-open")
    ).toBe("true");
    expect(getComputedStyle(getFullTreeChildList()!).display).toBe("none");

    renderNavigation(false);
    expect(getComputedStyle(getFullTreeChildList()!).display).toBe("none");
  });

  it("defers compact hover ownership to an ancestor when disabled", () => {
    const renderNavigation = (isNavigationCollapsed: boolean) =>
      renderTraceTree({
        spans: [ROOT_SPAN, CHILD_SPAN],
        isHoverOverlayEnabled: false,
        isNavigationCollapsed,
      });

    renderNavigation(true);
    const navigation = container.querySelector(".trace-tree-navigation");
    act(() => {
      navigation?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true })
      );
    });
    expect(
      container
        .querySelector(".trace-tree-navigation__full")
        ?.getAttribute("data-open")
    ).toBe("false");

    renderNavigation(false);
    renderNavigation(true);
    expect(
      container
        .querySelector(".trace-tree-navigation__full")
        ?.getAttribute("data-open")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="trace-tree-icon-rail"]')
        ?.hasAttribute("aria-hidden")
    ).toBe(false);
  });

  it("renders the session, trace, and root span in order", () => {
    const onTraceSelect = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN]}
                  session={{
                    sessionId: "session-12345678",
                    to: "/projects/project-1/sessions/session-node-id",
                  }}
                  traceSelection={{
                    isSelected: false,
                    onSelect: onTraceSelect,
                    traceId: "trace-12345678",
                  }}
                  selectedSpanNodeId={ROOT_SPAN.id}
                  scrollSelectedSpanIntoView={false}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const treeItems = container.querySelectorAll(
      '[data-testid="trace-tree"] > li'
    );
    const sessionLink = treeItems[0]?.querySelector("a");
    const traceButton = treeItems[1]?.querySelector<HTMLButtonElement>(
      'button[aria-label="View trace trace-12345678"]'
    );
    const idContainers = Array.from(
      container.querySelectorAll<HTMLElement>(".trace-tree-entity-item__id")
    );
    const idBadges = idContainers
      .map((idContainer) =>
        idContainer.querySelector<HTMLButtonElement>(".copyable-id-badge")
      )
      .filter((badge): badge is HTMLButtonElement => badge !== null);
    const textContent = container.textContent ?? "";

    expect(treeItems[0]?.textContent).toContain("Sessionsession-12345678");
    expect(sessionLink?.getAttribute("href")).toBe(
      "/projects/project-1/sessions/session-node-id"
    );
    expect(
      treeItems[0]?.querySelector(
        'button[aria-label="Copy Session ID session-12345678"]'
      )
    ).not.toBeNull();
    expect(sessionLink?.querySelector("button")).toBeNull();
    expect(treeItems[1]?.textContent).toContain("Tracetrace-12345678");
    expect(treeItems[1]?.querySelector(".icon-wrap")).not.toBeNull();
    expect(
      idContainers.map((idContainer) => ({
        justifyContent: getComputedStyle(idContainer).justifyContent,
        overflow: getComputedStyle(idContainer).overflow,
      }))
    ).toEqual([
      { justifyContent: "flex-end", overflow: "hidden" },
      { justifyContent: "flex-end", overflow: "hidden" },
    ]);
    expect(idBadges.map((badge) => badge.dataset.overflowMode)).toEqual([
      "truncate",
      "truncate",
    ]);
    expect(
      idBadges.map((badge) =>
        Number.parseFloat(getComputedStyle(badge).marginRight)
      )
    ).toEqual([0, 0]);
    expect(textContent.indexOf("Session")).toBeLessThan(
      textContent.indexOf("Trace")
    );
    expect(textContent.indexOf("Trace")).toBeLessThan(
      textContent.indexOf("root span")
    );

    act(() => traceButton?.click());

    expect(onTraceSelect).toHaveBeenCalledOnce();
  });

  it("renders a selectable trace row before the root span", () => {
    const onTraceSelect = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN]}
                  traceSelection={{
                    isSelected: true,
                    onSelect: onTraceSelect,
                    traceId: "trace-12345678",
                  }}
                  selectedSpanNodeId=""
                  scrollSelectedSpanIntoView={false}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const traceButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View trace trace-12345678"]'
    );
    const traceRow = traceButton?.parentElement;
    const textContent = container.textContent ?? "";

    expect(traceRow?.textContent).toContain("Tracetrace-12345678");
    expect(traceRow?.dataset.selected).toBe("true");
    expect(textContent.indexOf("Trace")).toBeLessThan(
      textContent.indexOf("root span")
    );

    act(() => traceButton?.click());

    expect(onTraceSelect).toHaveBeenCalledOnce();
  });

  it("renders span actions without removing row content or selecting the span", () => {
    const onSpanClick = vi.fn();
    const onAction = vi.fn();
    renderTraceTree({
      spans: [ROOT_SPAN],
      onSpanClick,
      renderSpanActions: () => (
        <button type="button" aria-label="Add annotation" onClick={onAction}>
          Add
        </button>
      ),
    });

    const spanRow = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const action = spanRow?.querySelector<HTMLButtonElement>(
      '.span-controls__actions button[aria-label="Add annotation"]'
    );

    expect(spanRow?.textContent).toContain("root span");
    act(() => action?.click());
    expect(onAction).toHaveBeenCalledOnce();
    expect(onSpanClick).not.toHaveBeenCalled();
  });

  it("keeps timing columns independent of span names and nesting", () => {
    renderTraceTree({
      spans: [ROOT_SPAN, CHILD_SPAN, GRANDCHILD_SPAN],
    });

    const nameColumns = Array.from(
      container.querySelectorAll<HTMLElement>(".span-tree-name")
    );
    const timingColumns = Array.from(
      container.querySelectorAll<HTMLElement>(".span-tree-timing")
    );
    const timelineBars = Array.from(
      container.querySelectorAll<HTMLElement>(".timeline-bar")
    );

    expect(nameColumns).toHaveLength(3);
    expect(new Set(nameColumns.map((column) => column.style.flex))).toEqual(
      new Set(["1 1 480px"])
    );
    expect(timingColumns).toHaveLength(3);
    expect(
      new Set(timingColumns.map((column) => getComputedStyle(column).flexBasis))
    ).toEqual(new Set(["150px"]));
    expect(timelineBars).toHaveLength(3);
    expect(
      new Set(timelineBars.map((bar) => getComputedStyle(bar).gridColumn))
    ).toEqual(new Set(["2"]));
  });

  it("uses darker timing text only in the light theme", () => {
    renderTraceTree({ spans: [ROOT_SPAN] });

    const timingColumn =
      container.querySelector<HTMLElement>(".span-tree-timing");
    const latencyText = timingColumn?.querySelector<HTMLElement>(
      ".latency-text .text"
    );
    const timingClassName = Array.from(timingColumn?.classList ?? []).find(
      (className) => className.startsWith("css-")
    );
    const latencyTextClassName = Array.from(latencyText?.classList ?? []).find(
      (className) => className.startsWith("css-")
    );
    const styleRules = Array.from(document.styleSheets).flatMap((styleSheet) =>
      Array.from(styleSheet.cssRules)
    );
    const defaultTextRule = styleRules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText === `.${latencyTextClassName}` &&
        rule.style.color !== ""
    );
    const lightThemeTextRule = styleRules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes(".theme--light") &&
        rule.selectorText.includes(`.${timingClassName}`) &&
        rule.selectorText.includes(".latency-text .text")
    );

    expect(defaultTextRule?.style.color).toBe("var(--global-text-color-500)");
    expect(lightThemeTextRule?.style.color).toBe(
      "var(--global-text-color-700)"
    );
  });

  it("reserves collapse-toggle space for spans without children", () => {
    renderTraceTree({
      spans: [ROOT_SPAN, CHILD_SPAN],
    });

    const rootSpanRow = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const childSpanRow = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${CHILD_SPAN.id}"]`
    );
    const rootToggleSlot = rootSpanRow?.querySelector<HTMLElement>(
      ".span-controls__collapse-toggle"
    );
    const childToggleSlot = childSpanRow?.querySelector<HTMLElement>(
      ".span-controls__collapse-toggle"
    );

    expect(
      rootToggleSlot?.querySelector(".collapse-toggle-button")
    ).not.toBeNull();
    expect(
      childToggleSlot?.querySelector(".collapse-toggle-button")
    ).toBeNull();
    expect(getComputedStyle(rootToggleSlot!).width).toBe("20px");
    expect(getComputedStyle(childToggleSlot!).width).toBe("20px");
  });

  it("shows 12 direct children before an expandable tree node", () => {
    const onSpanClick = vi.fn();
    const directChildren = Array.from({ length: 13 }, (_value, index) =>
      createTestSpan({
        nodeId: `direct-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );
    const omittedChild = directChildren[12];
    if (!omittedChild) throw new Error("Expected an omitted child fixture");
    const omittedDescendants = Array.from({ length: 5 }, (_value, index) =>
      createTestSpan({
        nodeId: `omitted-descendant-${index + 1}`,
        parent: omittedChild,
        startOffsetMs: 100 + index,
      })
    );

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren, ...omittedDescendants],
      onSpanClick,
      isChildTruncationEnabled: true,
    });

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="direct-child-12"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="direct-child-13"]'
      )
    ).toBeNull();

    const showMoreButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show more"]'
    );
    const showMoreListItem = showMoreButton?.closest("li");
    expect(showMoreButton?.textContent).toBe("Show more");
    expect(showMoreButton?.getAttribute("aria-expanded")).toBe("false");
    expect(showMoreListItem?.querySelector(".span-tree-edge")).not.toBeNull();
    expect(showMoreListItem?.querySelector('div[title=""] svg')).not.toBeNull();
    expect(
      showMoreListItem?.querySelector("[data-trace-tree-span-node-id]")
    ).toBeNull();

    act(() => showMoreButton?.click());

    expect(onSpanClick).not.toHaveBeenCalled();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="direct-child-13"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="omitted-descendant-5"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).toBeNull();

    const showLessButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show less"]'
    );
    const showLessListItem = showLessButton?.closest("li");
    expect(showLessButton?.textContent).toBe("Show less");
    expect(showLessButton?.getAttribute("aria-expanded")).toBe("true");
    expect(showLessListItem?.parentElement?.lastElementChild).toBe(
      showLessListItem
    );

    act(() => showLessButton?.click());

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="direct-child-13"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="omitted-descendant-5"]'
      )
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show less"]')
    ).toBeNull();
  });

  it("does not truncate children unless truncation is enabled", () => {
    const directChildren = Array.from({ length: 13 }, (_value, index) =>
      createTestSpan({
        nodeId: `unbounded-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren],
    });

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="unbounded-child-13"]'
      )
    ).not.toBeNull();
    expect(container.querySelector(".trace-tree-disclosure-node")).toBeNull();
  });

  it("applies full-tree truncation to the compact icon rail", () => {
    const directChildren = Array.from({ length: 13 }, (_value, index) =>
      createTestSpan({
        nodeId: `compact-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren],
      isChildTruncationEnabled: true,
      isNavigationCollapsed: true,
    });

    const compactSpanLabels = Array.from(
      container.querySelectorAll(
        '[data-testid="trace-tree-icon-rail"] button[aria-label^="View span"]'
      )
    ).map((button) => button.getAttribute("aria-label"));
    expect(compactSpanLabels).toHaveLength(13);
    expect(compactSpanLabels).toContain("View span compact-child-12");
    expect(compactSpanLabels).not.toContain("View span compact-child-13");
  });

  it("restores child truncation after a global expansion override ends", () => {
    const directChildren = Array.from({ length: 13 }, (_value, index) =>
      createTestSpan({
        nodeId: `global-expansion-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );
    const spans = [ROOT_SPAN, ...directChildren];
    const lastChildSelector =
      '[data-trace-tree-span-node-id="global-expansion-child-13"]';

    renderTraceTree({ spans, isChildTruncationEnabled: true });

    expect(container.querySelector(lastChildSelector)).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).not.toBeNull();

    renderTraceTree({ spans, isChildTruncationEnabled: false });

    expect(container.querySelector(lastChildSelector)).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).toBeNull();

    renderTraceTree({ spans, isChildTruncationEnabled: true });

    expect(container.querySelector(lastChildSelector)).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).not.toBeNull();
  });

  it("uses a limit of 8 at level three and deeper", () => {
    const levelOne = createTestSpan({
      nodeId: "level-one",
      parent: ROOT_SPAN,
      startOffsetMs: 1,
    });
    const levelTwo = Array.from({ length: 9 }, (_value, index) =>
      createTestSpan({
        nodeId: `level-two-${index + 1}`,
        parent: levelOne,
        startOffsetMs: 10 + index,
      })
    );
    const firstLevelTwo = levelTwo[0];
    if (!firstLevelTwo) throw new Error("Expected a level-two fixture");
    const levelThree = Array.from({ length: 9 }, (_value, index) =>
      createTestSpan({
        nodeId: `level-three-${index + 1}`,
        parent: firstLevelTwo,
        startOffsetMs: 100 + index,
      })
    );

    renderTraceTree({
      spans: [ROOT_SPAN, levelOne, ...levelTwo, ...levelThree],
      isChildTruncationEnabled: true,
    });

    expect(
      container.querySelector('[data-trace-tree-span-node-id="level-two-8"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-trace-tree-span-node-id="level-two-9"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-trace-tree-span-node-id="level-three-8"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-trace-tree-span-node-id="level-three-9"]')
    ).toBeNull();
  });

  it("shows every matching child while searching", () => {
    const directChildren = Array.from({ length: 13 }, (_value, index) => ({
      ...createTestSpan({
        nodeId: `searchable-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      }),
      name: `matching child ${index + 1}`,
    }));

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren],
      searchQuery: "matching child",
      isChildTruncationEnabled: true,
    });

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="searchable-child-13"]'
      )
    ).not.toBeNull();
    expect(container.querySelector(".trace-tree-disclosure-node")).toBeNull();
  });

  it("keeps an initially selected span visible without revealing its siblings", () => {
    const directChildren = Array.from({ length: 20 }, (_value, index) =>
      createTestSpan({
        nodeId: `selectable-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );
    const selectedSpan = directChildren[19];
    if (!selectedSpan) throw new Error("Expected a selected span fixture");

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren],
      selectedSpanNodeId: selectedSpan.id,
      isChildTruncationEnabled: true,
    });

    expect(
      container.querySelector(
        `[data-trace-tree-span-node-id="${selectedSpan.id}"]`
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="selectable-child-11"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="selectable-child-12"]'
      )
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).not.toBeNull();
  });

  it("reveals every omitted sibling from a selected-path show-more node", () => {
    const directChildren = Array.from({ length: 20 }, (_value, index) =>
      createTestSpan({
        nodeId: `middle-selection-child-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );
    const selectedSpan = directChildren[14];
    if (!selectedSpan) throw new Error("Expected a middle selection fixture");

    renderTraceTree({
      spans: [ROOT_SPAN, ...directChildren],
      selectedSpanNodeId: selectedSpan.id,
      isChildTruncationEnabled: true,
    });

    const showMoreButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show more"]'
    );
    expect(showMoreButton).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-12"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-15"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-20"]'
      )
    ).toBeNull();

    act(() => showMoreButton?.click());

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-12"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-20"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).toBeNull();

    const showLessButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show less"]'
    );
    expect(showLessButton).not.toBeNull();

    act(() => showLessButton?.click());

    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-12"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-15"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="middle-selection-child-20"]'
      )
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show more"]')
    ).not.toBeNull();
  });

  it("keeps a deep selected path bounded at every ancestor", () => {
    const levelOne = Array.from({ length: 20 }, (_value, index) =>
      createTestSpan({
        nodeId: `selected-path-level-one-${index + 1}`,
        parent: ROOT_SPAN,
        startOffsetMs: index + 1,
      })
    );
    const selectedLevelOne = levelOne[19];
    if (!selectedLevelOne) throw new Error("Expected a level-one selection");
    const levelTwo = Array.from({ length: 20 }, (_value, index) =>
      createTestSpan({
        nodeId: `selected-path-level-two-${index + 1}`,
        parent: selectedLevelOne,
        startOffsetMs: 100 + index,
      })
    );
    const selectedLevelTwo = levelTwo[19];
    if (!selectedLevelTwo) throw new Error("Expected a level-two selection");
    const levelThree = Array.from({ length: 12 }, (_value, index) =>
      createTestSpan({
        nodeId: `selected-path-level-three-${index + 1}`,
        parent: selectedLevelTwo,
        startOffsetMs: 200 + index,
      })
    );
    const selectedSpan = levelThree[11];
    if (!selectedSpan) throw new Error("Expected a level-three selection");

    renderTraceTree({
      spans: [ROOT_SPAN, ...levelOne, ...levelTwo, ...levelThree],
      selectedSpanNodeId: selectedSpan.id,
      isChildTruncationEnabled: true,
    });

    expect(
      container.querySelector(
        `[data-trace-tree-span-node-id="${selectedSpan.id}"]`
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="selected-path-level-one-12"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="selected-path-level-two-8"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-trace-tree-span-node-id="selected-path-level-three-8"]'
      )
    ).toBeNull();
    expect(
      container.querySelectorAll('button[aria-label="Show more"]')
    ).toHaveLength(3);
  });

  it("paints an optimistic span selection before starting navigation", () => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        scheduledFrames.set(frameId, callback);
        return frameId;
      })
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => scheduledFrames.delete(frameId))
    );
    const onSpanClick = vi.fn();
    const onSpanSelectionStart = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN, CHILD_SPAN]}
                  selectedSpanNodeId={ROOT_SPAN.id}
                  scrollSelectedSpanIntoView={false}
                  onSpanClick={onSpanClick}
                  onSpanSelectionStart={onSpanSelectionStart}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const rootSpan = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const childSpan = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${CHILD_SPAN.id}"]`
    );
    const rootTrigger = rootSpan?.parentElement;
    const childTrigger = childSpan?.parentElement;
    expect(childTrigger?.getAttribute("role")).toBe("button");

    act(() => childTrigger?.click());
    expect(rootSpan?.dataset.selected).toBe("false");
    expect(childSpan?.dataset.selected).toBe("true");
    expect(onSpanSelectionStart).toHaveBeenCalledOnce();
    expect(onSpanSelectionStart).toHaveBeenCalledWith(CHILD_SPAN);
    expect(onSpanClick).not.toHaveBeenCalled();

    onSpanSelectionStart.mockClear();
    act(() => rootTrigger?.click());
    expect(rootSpan?.dataset.selected).toBe("true");
    expect(childSpan?.dataset.selected).toBe("false");
    expect(onSpanSelectionStart).toHaveBeenCalledOnce();
    expect(onSpanSelectionStart).toHaveBeenCalledWith(ROOT_SPAN);
    expect(scheduledFrames.size).toBe(1);

    const runNextFrame = () => {
      const nextFrame = scheduledFrames.entries().next().value;
      if (!nextFrame) throw new Error("Expected a scheduled animation frame");
      const [frameId, callback] = nextFrame;
      scheduledFrames.delete(frameId);
      act(() => callback(0));
    };
    runNextFrame();
    expect(onSpanClick).not.toHaveBeenCalled();
    runNextFrame();
    expect(onSpanClick).toHaveBeenCalledOnce();
    expect(onSpanClick).toHaveBeenCalledWith(ROOT_SPAN);
  });
});
