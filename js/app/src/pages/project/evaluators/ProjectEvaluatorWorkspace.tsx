import { css } from "@emotion/react";
import type {
  Dispatch,
  PropsWithChildren,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
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
  normalizeWorkspaceModel,
  TabCloseButton,
  TabsetCollapseButton,
  TabsetMaximizeButton,
  useParentTabset,
  useParentTabsetState,
  useTabListOverflow,
  useWorkspaceRef,
  Workspace,
} from "react-resizable-panels";

import { Button } from "@phoenix/components/core/button";
import { Icon, Icons } from "@phoenix/components/core/icon";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { GripResizeHandle } from "@phoenix/components/resize";

/**
 * Every panel of the project evaluator workspace. Each is one tab; tabs can
 * be dragged between tabsets, split off to any edge, floated, collapsed,
 * maximized, and closed (and reopened from the layout menu).
 */
export type ProjectEvaluatorWorkspaceTabId =
  | "prompt"
  | "annotation"
  | "scope"
  | "details"
  | "variables"
  | "records"
  | "inspector";

type TabData = { panel: ProjectEvaluatorWorkspaceTabId };

type TabDefinition = {
  title: string;
  icon: ReactNode;
  /** The tabset a reopened tab goes back to, when it still exists. */
  homeTabsetId: string;
  isClosable: boolean;
};

const TAB_DEFINITIONS: Record<ProjectEvaluatorWorkspaceTabId, TabDefinition> = {
  prompt: {
    title: "Prompt",
    icon: <Icons.MessagesSquare />,
    homeTabsetId: "definition",
    isClosable: false,
  },
  annotation: {
    title: "Annotation",
    icon: <Icons.PriceTags />,
    homeTabsetId: "definition",
    isClosable: true,
  },
  scope: {
    title: "Scope",
    icon: <Icons.Funnel />,
    homeTabsetId: "definition",
    isClosable: true,
  },
  details: {
    title: "Details",
    icon: <Icons.Settings />,
    homeTabsetId: "definition",
    isClosable: true,
  },
  variables: {
    title: "Variables",
    icon: <Icons.Code />,
    homeTabsetId: "mapping",
    isClosable: true,
  },
  records: {
    title: "Records",
    icon: <Icons.List />,
    homeTabsetId: "bench",
    isClosable: false,
  },
  inspector: {
    title: "Inspector",
    icon: <Icons.ScanSearch />,
    homeTabsetId: "inspect",
    isClosable: true,
  },
};

const TAB_IDS = Object.keys(
  TAB_DEFINITIONS
) as ProjectEvaluatorWorkspaceTabId[];

const makeTab = (panel: ProjectEvaluatorWorkspaceTabId): TabNode<TabData> => ({
  id: panel,
  title: TAB_DEFINITIONS[panel].title,
  data: { panel },
  disableClose: !TAB_DEFINITIONS[panel].isClosable,
});

/**
 * Definition on the left, the mapping docked under it; records on the
 * right, the focused record's inspector under them. The two lower tabsets
 * collapse to their headers.
 */
const DEFAULT_MODEL: WorkspaceModelInput<TabData> = {
  version: 1,
  root: {
    type: "split",
    id: "root",
    orientation: "horizontal",
    children: [
      {
        type: "split",
        id: "left",
        orientation: "vertical",
        size: 46,
        children: [
          {
            type: "tabset",
            id: "definition",
            size: 66,
            minWidth: "380px",
            minHeight: "160px",
            selectedId: "prompt",
            tabs: [
              makeTab("prompt"),
              makeTab("annotation"),
              makeTab("scope"),
              makeTab("details"),
            ],
          },
          {
            type: "tabset",
            id: "mapping",
            size: 34,
            collapsible: true,
            minHeight: "96px",
            tabs: [makeTab("variables")],
          },
        ],
      },
      {
        type: "split",
        id: "right",
        orientation: "vertical",
        size: 54,
        children: [
          {
            type: "tabset",
            id: "bench",
            size: 52,
            minWidth: "440px",
            minHeight: "160px",
            tabs: [makeTab("records")],
          },
          {
            type: "tabset",
            id: "inspect",
            size: 48,
            collapsible: true,
            minHeight: "120px",
            tabs: [makeTab("inspector")],
          },
        ],
      },
    ],
  },
};

const STORAGE_KEY = "arize-phoenix-project-evaluator-workspace-v1";

function collectTabIds(model: WorkspaceModel<TabData>): Set<string> {
  const ids = new Set<string>();
  const visit = (node: WorkspaceModel<TabData>["root"]) => {
    if (node.type === "tabset") {
      node.tabs.forEach((tab) => ids.add(tab.id));
    } else {
      node.children.forEach(visit);
    }
  };
  visit(model.root);
  model.floating?.forEach((tabset) =>
    tabset.tabs.forEach((tab) => ids.add(tab.id))
  );
  return ids;
}

function collectTabsetIds(model: WorkspaceModel<TabData>): Set<string> {
  const ids = new Set<string>();
  const visit = (node: WorkspaceModel<TabData>["root"]) => {
    if (node.type === "tabset") {
      ids.add(node.id);
    } else {
      node.children.forEach(visit);
    }
  };
  visit(model.root);
  return ids;
}

function readSavedModel(): WorkspaceModelInput<TabData> {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved == null) {
      return DEFAULT_MODEL;
    }
    const model = normalizeWorkspaceModel<TabData>(JSON.parse(saved), {
      // Drop tabs a later version no longer has, and refresh titles.
      mapTab: (tab) =>
        tab.data?.panel != null && tab.data.panel in TAB_DEFINITIONS
          ? makeTab(tab.data.panel)
          : null,
    });
    if (model == null || !collectTabIds(model).has("prompt")) {
      return DEFAULT_MODEL;
    }
    return model;
  } catch {
    return DEFAULT_MODEL;
  }
}

function saveModel(model: WorkspaceModel<TabData>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Storage may be full or blocked; the layout just isn't remembered.
  }
}

/**
 * Elements a panel renders into from elsewhere in the tree. The test bench
 * owns the focused-record state its table and inspector share, so it keeps
 * rendering both, and portals the inspector into the inspector tab.
 */
type WorkspaceSlots = Record<ProjectEvaluatorWorkspaceTabId, HTMLElement>;

const WorkspaceSlotsContext = createContext<WorkspaceSlots | null>(null);

/**
 * The element of a workspace tab, to portal into; `undefined` outside a
 * workspace, where the caller keeps its own layout.
 */
export function useProjectEvaluatorWorkspaceSlot(
  panel: ProjectEvaluatorWorkspaceTabId
): HTMLElement | undefined {
  return useContext(WorkspaceSlotsContext)?.[panel];
}

/** Renders `children` into the given tab when the workspace has it open. */
export function ProjectEvaluatorWorkspacePortal({
  panel,
  children,
}: PropsWithChildren<{ panel: ProjectEvaluatorWorkspaceTabId }>) {
  const slot = useProjectEvaluatorWorkspaceSlot(panel);
  if (slot === undefined) {
    return null;
  }
  return createPortal(children, slot);
}

type WorkspaceController = {
  workspaceRef: RefObject<WorkspaceImperativeHandle<TabData> | null>;
  openTabIds: Set<string>;
  setOpenTabIds: Dispatch<SetStateAction<Set<string>>>;
  defaultModel: WorkspaceModelInput<TabData>;
};

const WorkspaceControllerContext = createContext<WorkspaceController | null>(
  null
);

function useWorkspaceController(): WorkspaceController {
  const controller = useContext(WorkspaceControllerContext);
  if (controller == null) {
    throw new Error(
      "useWorkspaceController must be used within ProjectEvaluatorWorkspaceProvider"
    );
  }
  return controller;
}

/**
 * Shares the workspace's imperative handle between the workspace and the
 * layout menu in the dialog header.
 */
export function ProjectEvaluatorWorkspaceProvider({
  children,
}: PropsWithChildren) {
  // An object ref: the handle is replaced on renders, so holding it in state
  // would re-render the workspace in a loop.
  const workspaceRef = useWorkspaceRef<TabData>();
  const [defaultModel] = useState(readSavedModel);
  const [openTabIds, setOpenTabIds] = useState<Set<string>>(() => {
    const normalized = normalizeWorkspaceModel<TabData>(defaultModel);
    return normalized ? collectTabIds(normalized) : new Set(TAB_IDS);
  });
  const value = useMemo(
    () => ({
      workspaceRef,
      openTabIds,
      setOpenTabIds,
      defaultModel,
    }),
    [workspaceRef, openTabIds, defaultModel]
  );
  return (
    <WorkspaceControllerContext.Provider value={value}>
      {children}
    </WorkspaceControllerContext.Provider>
  );
}

/**
 * The project evaluator form as an IDE-style workspace: each part of the
 * form is a tab the author arranges, and the arrangement is remembered.
 */
export function ProjectEvaluatorWorkspace({
  panels,
  badges,
}: {
  panels: Record<ProjectEvaluatorWorkspaceTabId, ReactNode>;
  /** Shown after a tab's title, e.g. how many variables are unbound. */
  badges?: Partial<Record<ProjectEvaluatorWorkspaceTabId, ReactNode>>;
}) {
  const { workspaceRef, setOpenTabIds, defaultModel } =
    useWorkspaceController();
  // One element per panel for the whole life of the form, moved into the
  // tab that shows it. A portal into it keeps its content (and the state
  // that content holds) however the tab is moved, hidden, or closed.
  const [slots] = useState(
    () =>
      Object.fromEntries(
        TAB_IDS.map((panel) => {
          const element = document.createElement("div");
          element.className = "evaluator-workspace__slot";
          return [panel, element] as const;
        })
      ) as unknown as WorkspaceSlots
  );
  const renderTabContent = useCallback(
    (tab: TabNode<TabData>) => (
      <WorkspaceSlotHost panel={tab.data.panel} slot={slots[tab.data.panel]} />
    ),
    [slots]
  );
  return (
    <WorkspaceSlotsContext.Provider value={slots}>
      <Workspace<TabData>
        workspaceRef={workspaceRef}
        defaultModel={defaultModel}
        css={workspaceCSS}
        tabsetMinWidth="240px"
        tabsetMinHeight="64px"
        tabRemovalSelectionBehavior="recent"
        renderTabContent={renderTabContent}
        renderTab={(tab, props) => (
          <WorkspaceTab
            tab={tab}
            props={props}
            badge={badges?.[tab.data.panel]}
          />
        )}
        renderTabsetToolbar={(tabset) => (
          <WorkspaceTabsetToolbar tabset={tabset} />
        )}
        renderSeparator={() => <GripResizeHandle />}
        renderDragPreview={(tab) => (
          <span css={dragPreviewCSS}>
            {TAB_DEFINITIONS[tab.data.panel].title}
          </span>
        )}
        renderEmptyTabset={() => (
          <div className="evaluator-workspace__empty">Drop a tab here</div>
        )}
        onModelChanged={(model) => {
          saveModel(model);
          const next = collectTabIds(model);
          setOpenTabIds((current) =>
            current.size === next.size &&
            [...next].every((id) => current.has(id))
              ? current
              : next
          );
        }}
      />
      {TAB_IDS.map((panel) =>
        panels[panel] != null
          ? createPortal(panels[panel], slots[panel], panel)
          : null
      )}
    </WorkspaceSlotsContext.Provider>
  );
}

function WorkspaceSlotHost({
  panel,
  slot,
}: {
  panel: ProjectEvaluatorWorkspaceTabId;
  slot: HTMLElement;
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
      data-panel-kind={panel}
    />
  );
}

function WorkspaceTab({
  tab,
  props,
  badge,
}: {
  tab: TabNode<TabData>;
  props: TabRenderProps;
  badge?: ReactNode;
}) {
  const definition = TAB_DEFINITIONS[tab.data.panel];
  return (
    <div {...props} title={definition.title}>
      {definition.title}
      {badge}
      {definition.isClosable ? (
        <TabCloseButton className="evaluator-workspace__tab-close">
          <Icon svg={<Icons.Close />} />
        </TabCloseButton>
      ) : null}
    </div>
  );
}

function WorkspaceTabsetToolbar({ tabset }: { tabset: TabsetNode<TabData> }) {
  const parent = useParentTabset();
  const state = useParentTabsetState();
  const overflowTabIds = useTabListOverflow();
  const overflowTabs = tabset.tabs.filter((tab) =>
    overflowTabIds.includes(tab.id)
  );
  return (
    <div className="evaluator-workspace__toolbar" data-tabset-kind={tabset.id}>
      {overflowTabs.length > 0 && !state?.isCollapsed ? (
        <MenuTrigger>
          <button
            type="button"
            className="evaluator-workspace__tool evaluator-workspace__overflow"
            title="More tabs"
            aria-label={`${overflowTabs.length} more tabs`}
          >
            <Icon svg={<Icons.ChevronRightDouble />} />
            <span>{overflowTabs.length}</span>
          </button>
          <MenuContainer minHeight="auto">
            <Menu
              aria-label="More tabs"
              onAction={(key) => parent?.selectTab(String(key))}
            >
              {overflowTabs.map((tab) => (
                <MenuItem
                  key={tab.id}
                  id={tab.id}
                  textValue={TAB_DEFINITIONS[tab.data.panel].title}
                  leadingContent={
                    <Icon svg={TAB_DEFINITIONS[tab.data.panel].icon} />
                  }
                >
                  {TAB_DEFINITIONS[tab.data.panel].title}
                </MenuItem>
              ))}
            </Menu>
          </MenuContainer>
        </MenuTrigger>
      ) : null}
      {state && !state.isFloating && !state.isRoot && !state.isMaximized ? (
        <button
          type="button"
          className="evaluator-workspace__tool"
          title="Float panel"
          aria-label="Float panel"
          onClick={() => parent?.float({ width: 520, height: 420 })}
        >
          <Icon svg={<Icons.ArrowUpRightCorner />} />
        </button>
      ) : null}
      <TabsetCollapseButton
        className="evaluator-workspace__tool"
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
 * The layout menu in the dialog header: show or hide each panel, and put
 * everything back where it started.
 */
export function ProjectEvaluatorWorkspaceLayoutMenu() {
  const { workspaceRef, openTabIds } = useWorkspaceController();
  return (
    <MenuTrigger>
      <Button
        size="S"
        variant="quiet"
        leadingVisual={<Icon svg={<Icons.GridFilled />} />}
        aria-label="Layout"
      >
        Layout
      </Button>
      <MenuContainer minHeight="auto">
        <Menu
          aria-label="Layout"
          onAction={(key) => {
            const workspace = workspaceRef.current;
            if (workspace == null) {
              return;
            }
            if (key === "reset") {
              const model = workspace.setModel(DEFAULT_MODEL);
              saveModel(model);
              return;
            }
            const panel = key as ProjectEvaluatorWorkspaceTabId;
            if (openTabIds.has(panel)) {
              if (TAB_DEFINITIONS[panel].isClosable) {
                workspace.closeTab(panel);
              } else {
                workspace.selectTab(panel);
              }
              return;
            }
            const home = TAB_DEFINITIONS[panel].homeTabsetId;
            const tabsetIds = collectTabsetIds(workspace.getModel());
            if (tabsetIds.has(home)) {
              workspace.addTab(makeTab(panel), { tabsetId: home });
            } else {
              workspace.addTab(makeTab(panel), {
                target: { edge: panel === "variables" ? "bottom" : "right" },
                size: 30,
              });
            }
          }}
        >
          <MenuSectionTitle title="Panels" />
          {TAB_IDS.map((panel) => (
            <MenuItem
              key={panel}
              id={panel}
              textValue={TAB_DEFINITIONS[panel].title}
              leadingContent={<Icon svg={TAB_DEFINITIONS[panel].icon} />}
              trailingContent={
                openTabIds.has(panel) ? (
                  <Icon svg={<Icons.Checkmark />} />
                ) : null
              }
            >
              {TAB_DEFINITIONS[panel].title}
            </MenuItem>
          ))}
          <MenuItem
            id="reset"
            textValue="Reset layout"
            leadingContent={<Icon svg={<Icons.Refresh />} />}
          >
            Reset layout
          </MenuItem>
        </Menu>
      </MenuContainer>
    </MenuTrigger>
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

  [data-tabset] {
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

  .evaluator-workspace__tab-close,
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
  // The inline icon button size: a 20px square.
  .evaluator-workspace__tab-close {
    width: var(--global-dimension-size-250);
    height: var(--global-dimension-size-250);
    margin-inline-end: calc(-1 * var(--global-dimension-size-100));
    font-size: var(--global-font-size-s);
    color: var(--global-text-color-500);
  }
  // The small icon button size.
  .evaluator-workspace__tool {
    width: var(--global-button-height-s);
    height: var(--global-button-height-s);
    font-size: var(--global-font-size-l);
  }
  .evaluator-workspace__overflow {
    width: auto;
    gap: var(--global-dimension-size-25);
    padding: 0 var(--global-dimension-size-50);
    font-size: var(--global-font-size-s);
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
  [data-panel-kind="prompt"] > .evaluator-workspace__slot,
  [data-panel-kind="annotation"] > .evaluator-workspace__slot,
  [data-panel-kind="scope"] > .evaluator-workspace__slot,
  [data-panel-kind="details"] > .evaluator-workspace__slot,
  [data-panel-kind="variables"] > .evaluator-workspace__slot {
    padding: var(--global-dimension-size-200);
  }
  [data-panel-kind="records"] > .evaluator-workspace__slot,
  [data-panel-kind="inspector"] > .evaluator-workspace__slot {
    overflow: hidden;
    scrollbar-gutter: auto;
  }
  [data-panel-kind="records"] > .evaluator-workspace__slot {
    padding-top: var(--global-dimension-size-200);
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
