import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  TabNode,
  TabRenderProps,
  TabsetNode,
  WorkspaceImperativeHandle,
  WorkspaceModel,
  WorkspaceModelInput,
} from "react-resizable-panels";
import {
  TabsetCollapseButton,
  TabsetMaximizeButton,
  useParentTabset,
  useParentTabsetState,
  useTabListOverflow,
  useWorkspaceRef,
  Workspace,
} from "react-resizable-panels";

import { Button, IconButton } from "@phoenix/components/core/button";
import { Icon, Icons } from "@phoenix/components/core/icon";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import type {
  EvaluatorWorkspaceLayout,
  EvaluatorWorkspacePanelDefinition,
  EvaluatorWorkspaceTabData,
} from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";
import { resolveSavedWorkspaceModel } from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";
import { GripResizeHandle } from "@phoenix/components/resize";

type TabData = EvaluatorWorkspaceTabData;
type PanelDefinition = EvaluatorWorkspacePanelDefinition;

function readSavedModel(
  layout: EvaluatorWorkspaceLayout
): WorkspaceModelInput<TabData> {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(layout.storageKey);
  } catch {
    // Storage may be blocked; start from the layout's default.
  }
  return resolveSavedWorkspaceModel({ layout, saved });
}

function saveModel({
  layout,
  model,
}: {
  layout: EvaluatorWorkspaceLayout;
  model: WorkspaceModel<TabData>;
}) {
  try {
    window.localStorage.setItem(layout.storageKey, JSON.stringify(model));
  } catch {
    // Storage may be full or blocked; the layout just isn't remembered.
  }
}

/**
 * Elements a panel renders into from elsewhere in the tree, so a component
 * that owns state two panels share can render into both (see
 * {@link EvaluatorWorkspacePortal}).
 */
type WorkspaceSlots = Record<string, HTMLElement>;

const WorkspaceSlotsContext = createContext<WorkspaceSlots | null>(null);

/**
 * The element of a workspace panel, to portal into; `undefined` outside a
 * workspace, where the caller keeps its own layout.
 */
export function useEvaluatorWorkspaceSlot(
  panel: string
): HTMLElement | undefined {
  return useContext(WorkspaceSlotsContext)?.[panel];
}

/** Renders `children` into the given panel of the enclosing workspace. */
export function EvaluatorWorkspacePortal({
  panel,
  children,
}: PropsWithChildren<{ panel: string }>) {
  const slot = useEvaluatorWorkspaceSlot(panel);
  if (slot === undefined) {
    return null;
  }
  return createPortal(children, slot);
}

type WorkspaceController = {
  layout: EvaluatorWorkspaceLayout;
  workspaceRef: RefObject<WorkspaceImperativeHandle<TabData> | null>;
  initialModel: WorkspaceModelInput<TabData>;
  slots: WorkspaceSlots;
};

const WorkspaceControllerContext = createContext<WorkspaceController | null>(
  null
);

function useWorkspaceController(): WorkspaceController {
  const controller = useContext(WorkspaceControllerContext);
  if (controller == null) {
    throw new Error(
      "useWorkspaceController must be used within EvaluatorWorkspaceProvider"
    );
  }
  return controller;
}

/**
 * Shares a workspace's layout and imperative handle between the workspace
 * and the reset button in the dialog header.
 */
export function EvaluatorWorkspaceProvider({
  layout,
  children,
}: PropsWithChildren<{ layout: EvaluatorWorkspaceLayout }>) {
  // An object ref: the handle is replaced on renders, so holding it in state
  // would re-render the workspace in a loop.
  const workspaceRef = useWorkspaceRef<TabData>();
  const [initialModel] = useState(() => readSavedModel(layout));
  // One element per panel for the whole life of the form, moved into the
  // tab that shows it. A portal into it keeps its content (and the state
  // that content holds) however the tab is moved or hidden.
  const [slots] = useState<WorkspaceSlots>(() =>
    Object.fromEntries(
      Object.keys(layout.panels).map((panel) => {
        const element = document.createElement("div");
        element.className = "evaluator-workspace__slot";
        return [panel, element];
      })
    )
  );
  const value = useMemo(
    () => ({ layout, workspaceRef, initialModel, slots }),
    [layout, workspaceRef, initialModel, slots]
  );
  return (
    <WorkspaceControllerContext.Provider value={value}>
      {children}
    </WorkspaceControllerContext.Provider>
  );
}

/**
 * An evaluator form as an IDE-style workspace: each part of the form is a
 * panel the author arranges, and the arrangement is remembered.
 */
export function EvaluatorWorkspace<PanelId extends string>({
  panels,
  badges,
}: {
  /** `null` for a panel another panel renders into with a portal. */
  panels: Record<PanelId, ReactNode>;
  /** Shown after a tab's title, e.g. how many variables are unbound. */
  badges?: Partial<Record<PanelId, ReactNode>>;
}) {
  const { layout, workspaceRef, initialModel, slots } =
    useWorkspaceController();
  const renderTabContent = useCallback(
    (tab: TabNode<TabData>) => (
      <WorkspaceSlotHost
        slot={slots[tab.data.panel]}
        definition={layout.panels[tab.data.panel]}
      />
    ),
    [slots, layout]
  );
  const titleOf = (tab: TabNode<TabData>) =>
    layout.panels[tab.data.panel]?.title ?? tab.id;
  const panelEntries = Object.entries(panels) as [PanelId, ReactNode][];
  const badgeOf = (tab: TabNode<TabData>) =>
    (badges as Record<string, ReactNode> | undefined)?.[tab.data.panel];
  return (
    <WorkspaceSlotsContext.Provider value={slots}>
      <Workspace<TabData>
        workspaceRef={workspaceRef}
        defaultModel={initialModel}
        css={workspaceCSS}
        tabsetMinWidth="240px"
        tabsetMinHeight="64px"
        tabRemovalSelectionBehavior="recent"
        renderTabContent={renderTabContent}
        renderTab={(tab, props) => (
          <WorkspaceTab
            title={titleOf(tab)}
            props={props}
            badge={badgeOf(tab)}
          />
        )}
        renderTabsetToolbar={(tabset) => (
          <WorkspaceTabsetToolbar tabset={tabset} titleOf={titleOf} />
        )}
        renderSeparator={() => <GripResizeHandle />}
        renderDragPreview={(tab) => (
          <span css={dragPreviewCSS}>{titleOf(tab)}</span>
        )}
        renderEmptyTabset={() => (
          <div className="evaluator-workspace__empty">Drop a tab here</div>
        )}
        onModelChanged={(model) => saveModel({ layout, model })}
      />
      {panelEntries.map(([panel, content]) =>
        content != null && slots[panel] != null
          ? createPortal(content, slots[panel], panel)
          : null
      )}
    </WorkspaceSlotsContext.Provider>
  );
}

function WorkspaceSlotHost({
  slot,
  definition,
}: {
  slot: HTMLElement;
  definition: PanelDefinition;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host == null) {
      return undefined;
    }
    host.appendChild(slot);
    return () => {
      if (slot.parentElement === host) {
        host.removeChild(slot);
      }
    };
  }, [slot]);
  return (
    <div
      ref={hostRef}
      className="evaluator-workspace__content"
      data-padding={definition.padding ?? "all"}
      data-scroll={definition.scroll ?? "tab"}
    />
  );
}

function WorkspaceTab({
  title,
  props,
  badge,
}: {
  title: string;
  props: TabRenderProps;
  badge?: ReactNode;
}) {
  return (
    <div {...props} title={title}>
      {title}
      {badge}
    </div>
  );
}

function WorkspaceTabsetToolbar({
  tabset,
  titleOf,
}: {
  tabset: TabsetNode<TabData>;
  titleOf: (tab: TabNode<TabData>) => string;
}) {
  const parent = useParentTabset();
  const state = useParentTabsetState();
  // A tab cut off at the edge is as hard to reach as one out of view.
  const overflowTabIds = useTabListOverflow({ includePartiallyVisible: true });
  const overflowTabs = tabset.tabs.filter((tab) =>
    overflowTabIds.includes(tab.id)
  );
  return (
    <div className="evaluator-workspace__toolbar">
      {overflowTabs.length > 0 && !state?.isCollapsed ? (
        <MenuTrigger>
          {/* A React Aria button: MenuTrigger opens on presses its child
              reports, which a native button does not. */}
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.ChevronRightDouble />} />}
            aria-label={`${overflowTabs.length} more tabs`}
          >
            {String(overflowTabs.length)}
          </Button>
          <MenuContainer minHeight="auto">
            <Menu
              aria-label="More tabs"
              onAction={(key) => parent?.selectTab(String(key))}
            >
              {overflowTabs.map((tab) => (
                <MenuItem key={tab.id} id={tab.id} textValue={titleOf(tab)}>
                  {titleOf(tab)}
                </MenuItem>
              ))}
            </Menu>
          </MenuContainer>
        </MenuTrigger>
      ) : null}
      {state && !state.isFloating && !state.isRoot && !state.isMaximized ? (
        <IconButton
          size="S"
          aria-label="Float panel"
          onPress={() => parent?.float({ width: 520, height: 420 })}
        >
          <Icon svg={<Icons.ArrowUpRightCorner />} />
        </IconButton>
      ) : null}
      {/* Fixed names, with aria-expanded and aria-pressed giving the state,
          in place of the library's "Collapse tabset" and "Maximize
          tabset". */}
      <TabsetCollapseButton
        className="evaluator-workspace__tool"
        aria-label="Collapse panel"
        title={({ isCollapsed }) =>
          isCollapsed ? "Expand panel" : "Collapse panel"
        }
      >
        {({ isCollapsed }) => (
          <Icon
            svg={isCollapsed ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          />
        )}
      </TabsetCollapseButton>
      <TabsetMaximizeButton
        className="evaluator-workspace__tool"
        aria-label="Maximize panel"
        title={({ isMaximized }) =>
          isMaximized ? "Restore panel" : "Maximize panel"
        }
      >
        {({ isMaximized }) => (
          <Icon svg={isMaximized ? <Icons.Collapse /> : <Icons.Expand />} />
        )}
      </TabsetMaximizeButton>
    </div>
  );
}

/**
 * Returns a function that brings the first invalid field into view: it
 * selects the tab that holds it, expanding or restoring its tabset as
 * needed, and focuses the field. A failed submit calls it, since the field
 * can sit in a tab that is not selected.
 */
export function useRevealInvalidWorkspaceField(): () => void {
  const { workspaceRef, slots } = useWorkspaceController();
  return useCallback(() => {
    // After the validation state has rendered the fields as invalid.
    window.requestAnimationFrame(() => {
      const workspace = workspaceRef.current;
      if (workspace == null) {
        return;
      }
      const model = workspace.getModel();
      for (const tabset of listTabsets(model)) {
        for (const tab of tabset.tabs) {
          const field = slots[tab.id]?.querySelector<HTMLElement>(
            '[aria-invalid="true"]'
          );
          if (field == null) {
            continue;
          }
          if (
            model.maximizedTabsetId != null &&
            model.maximizedTabsetId !== tabset.id
          ) {
            workspace.restoreTabset();
          }
          if (tabset.collapsed) {
            workspace.expandTabset(tabset.id);
          }
          workspace.selectTab(tab.id);
          focusOnceShown(field);
          return;
        }
      }
    });
  }, [workspaceRef, slots]);
}

/**
 * The tab's content is shown some frames after it is selected, and a field
 * that is not shown yet cannot take focus, so try again each frame until it
 * is (for at most about half a second).
 */
function focusOnceShown(field: HTMLElement, framesLeft = 30) {
  const box = field.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) {
    field.focus();
    if (document.activeElement === field) {
      return;
    }
  }
  if (framesLeft > 0) {
    window.requestAnimationFrame(() => focusOnceShown(field, framesLeft - 1));
  }
}

/** Every tabset, in reading order, then the floating ones. */
function listTabsets(model: WorkspaceModel<TabData>): TabsetNode<TabData>[] {
  const tabsets: TabsetNode<TabData>[] = [];
  const visit = (node: WorkspaceModel<TabData>["root"]) => {
    if (node.type === "tabset") {
      tabsets.push(node);
    } else {
      node.children.forEach(visit);
    }
  };
  visit(model.root);
  return [...tabsets, ...(model.floating ?? [])];
}

/** Puts every panel back where the layout starts it. */
export function EvaluatorWorkspaceResetButton() {
  const { layout, workspaceRef } = useWorkspaceController();
  return (
    <Button
      size="S"
      variant="quiet"
      leadingVisual={<Icon svg={<Icons.Refresh />} />}
      onPress={() => {
        const model = workspaceRef.current?.setModel(layout.defaultModel);
        if (model != null) {
          saveModel({ layout, model });
        }
      }}
    >
      Reset layout
    </Button>
  );
}

/**
 * Tabsets sit flush against each other and the dialog, split by the same
 * grip divider as the rest of the evaluator form. Tabs follow the design
 * system's horizontal `Tabs`: a hover pill, a 3px primary indicator under the
 * selected tab, and the standard focus ring.
 */
const workspaceCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  background-color: var(--global-background-color-default);

  // A tabset fills the panel the split gives it; without a height it grows
  // with its content, and the panel clips it instead of the tab scrolling.
  [data-tabset] {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background-color: var(--global-background-color-default);
    // Each tabset is its own stacking context, so sticky headers inside one
    // never paint over a maximized or floating tabset.
    isolation: isolate;
  }
  [data-tabset-maximized] {
    z-index: var(--global-z-index-local-raised);
  }
  [data-floating-tabset] {
    z-index: var(--global-z-index-local-overlay);
    border: var(--global-border-size-thin) solid
      var(--global-popover-border-color);
    border-radius: var(--global-rounding-medium);
    overflow: hidden;
    box-shadow: 0px 8px 16px var(--global-overlay-shadow-color);
  }

  [data-tabset-header] {
    display: flex;
    align-items: stretch;
    flex: none;
    // The bottom edge is an inset shadow, as under the design system's tab
    // list, so tabs scrolled beneath it never cover it.
    box-shadow: inset 0 -1px 0 0 var(--global-border-color-default);
    user-select: none;
  }
  [data-tabset-collapsed] [data-tabset-header] {
    box-shadow: none;
  }

  [data-tab-list] {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  [data-tab] {
    position: relative;
    isolation: isolate;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    font-weight: 400;
    color: var(--global-text-color-700);
    white-space: nowrap;
    cursor: default;
    outline: none;
    transition: color 150ms ease-out;
    -webkit-tap-highlight-color: transparent;
    // Hover pill and focus ring, inset from the hit area as in Tabs.
    &::before {
      content: "";
      position: absolute;
      inset: var(--global-dimension-size-50);
      border-radius: var(--global-rounding-small);
      transition: background 150ms ease-out;
      z-index: -1;
    }
    // Selection indicator.
    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      border-radius: var(--global-rounding-small);
      background: transparent;
    }
    &:hover,
    &[data-tab-selected] {
      color: var(--global-text-color-900);
    }
    &:hover:not([data-tab-selected])::before {
      background: var(--global-color-primary-50);
    }
    &:focus-visible::before {
      border: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
    @media (prefers-reduced-motion: reduce) {
      &,
      &::before {
        transition: none;
      }
    }
  }
  [data-tab][data-tab-selected]::after {
    background: var(--global-color-primary);
  }
  // A collapsed tabset shows only its header; nothing is selected in view.
  [data-tabset-collapsed] [data-tab][data-tab-selected] {
    color: var(--global-text-color-700);
    &::after {
      background: transparent;
    }
  }
  [data-tab][data-tab-dragging] {
    opacity: var(--global-opacity-disabled);
  }

  // The collapse and maximize buttons are the library's own, drawn here as
  // the small icon button.
  .evaluator-workspace__tool {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-700);
    cursor: pointer;
    transition: background-color 0.2s ease;
    .icon-wrap {
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }
    &:hover {
      background-color: var(--hover-background);
      .icon-wrap {
        opacity: 1;
      }
    }
    &:active {
      background-color: var(--global-color-primary-100);
      color: var(--global-text-color-900);
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
    &[aria-disabled="true"] {
      opacity: var(--global-opacity-disabled);
      cursor: not-allowed;
    }
  }
  // The small icon button size.
  .evaluator-workspace__tool {
    width: var(--global-button-height-s);
    height: var(--global-button-height-s);
    font-size: var(--global-font-size-l);
  }

  [data-tabset-toolbar] {
    display: flex;
    align-items: center;
    flex: none;
    padding-inline: var(--global-dimension-size-50)
      var(--global-dimension-size-100);
  }
  .evaluator-workspace__toolbar {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
  }

  [data-tab-panels] {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  [data-tab-content] {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .evaluator-workspace__content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .evaluator-workspace__slot {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
    overscroll-behavior: none;
    scrollbar-gutter: stable;
  }
  [data-padding="all"] > .evaluator-workspace__slot {
    padding: var(--global-dimension-size-200);
  }
  [data-padding="top"] > .evaluator-workspace__slot {
    padding-top: var(--global-dimension-size-200);
  }
  // A panel that lays out its own scrolling regions, like a table with a
  // pinned header, fills the tab instead of scrolling as a whole.
  [data-scroll="self"] > .evaluator-workspace__slot {
    overflow: hidden;
    scrollbar-gutter: auto;
  }

  // Where a dragged tab will land, drawn as the file drop zone marks a target.
  [data-drop-indicator] {
    z-index: var(--global-z-index-local-overlay);
    border: var(--global-border-size-thin) solid var(--global-color-primary);
    background-color: var(--global-color-primary-100);
    transition:
      inset 90ms ease-out,
      width 90ms ease-out,
      height 90ms ease-out;
    pointer-events: none;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  .evaluator-workspace__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--global-text-color-300);
    font-size: var(--global-font-size-s);
  }
`;

// The preview follows the pointer outside the workspace element, so it
// carries its own styles; it is drawn as a popover.
const dragPreviewCSS = css`
  display: inline-flex;
  align-items: center;
  padding: var(--global-dimension-size-50) var(--global-dimension-size-150);
  border: var(--global-border-size-thin) solid
    var(--global-popover-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-popover-background-color);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  white-space: nowrap;
  box-shadow: 0px 8px 16px var(--global-overlay-shadow-color);
`;
