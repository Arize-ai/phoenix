import type {
  TabNode,
  WorkspaceModel,
  WorkspaceModelInput,
  WorkspaceNodeInput,
} from "react-resizable-panels";
import { normalizeWorkspaceModel } from "react-resizable-panels";

export type EvaluatorWorkspaceTabData = { panel: string };

export type EvaluatorWorkspacePanelDefinition = {
  title: string;
  /**
   * `self` for a panel that lays out its own scrolling regions; by default
   * the tab scrolls the panel as a whole.
   */
  scroll?: "tab" | "self";
  /**
   * `all` by default; `top` for a panel whose content pads its own sides;
   * `none` for one that draws to the edges.
   */
  padding?: "all" | "top" | "none";
};

/**
 * A form's workspace: its panels, where each starts, and where the author's
 * arrangement of them is remembered. Every panel is one tab; tabs move
 * between tabsets, split to any edge, float, collapse, and maximize, but are
 * never closed, so every part of the form stays reachable.
 */
export type EvaluatorWorkspaceLayout<PanelId extends string = string> = {
  storageKey: string;
  panels: Record<PanelId, EvaluatorWorkspacePanelDefinition>;
  defaultModel: WorkspaceModelInput<EvaluatorWorkspaceTabData>;
};

/**
 * Builds a layout, giving `root` a function that makes the tab for a panel.
 *
 * @example
 * defineEvaluatorWorkspaceLayout({
 *   storageKey: "arize-phoenix-my-form-workspace-v1",
 *   panels: { prompt: { title: "Prompt" }, test: { title: "Test" } },
 *   root: (tab) => ({ type: "tabset", tabs: [tab("prompt"), tab("test")] }),
 * });
 */
export function defineEvaluatorWorkspaceLayout<PanelId extends string>({
  storageKey,
  panels,
  root,
}: {
  storageKey: string;
  panels: Record<PanelId, EvaluatorWorkspacePanelDefinition>;
  root: (
    tab: (panel: PanelId) => TabNode<EvaluatorWorkspaceTabData>
  ) => WorkspaceNodeInput<EvaluatorWorkspaceTabData>;
}): EvaluatorWorkspaceLayout<PanelId> {
  const tab = (panel: PanelId) =>
    makeEvaluatorWorkspaceTab({ panel, title: panels[panel].title });
  return { storageKey, panels, defaultModel: { version: 1, root: root(tab) } };
}

function makeEvaluatorWorkspaceTab({
  panel,
  title,
}: {
  panel: string;
  title: string;
}): TabNode<EvaluatorWorkspaceTabData> {
  return { id: panel, title, data: { panel }, disableClose: true };
}

function collectTabIds(
  model: WorkspaceModel<EvaluatorWorkspaceTabData>
): Set<string> {
  const ids = new Set<string>();
  const visit = (node: WorkspaceModel<EvaluatorWorkspaceTabData>["root"]) => {
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

/**
 * The saved arrangement, when it still holds exactly this layout's panels;
 * otherwise (nothing saved, a panel added or removed since) the default.
 */
export function resolveSavedWorkspaceModel({
  layout,
  saved,
}: {
  layout: EvaluatorWorkspaceLayout;
  /** What was stored under the layout's `storageKey`, if anything. */
  saved: string | null;
}): WorkspaceModelInput<EvaluatorWorkspaceTabData> {
  try {
    if (saved == null) {
      return layout.defaultModel;
    }
    const model = normalizeWorkspaceModel<EvaluatorWorkspaceTabData>(
      JSON.parse(saved),
      {
        mapTab: (tab) => {
          const definition = layout.panels[tab.data?.panel];
          return definition == null
            ? null
            : makeEvaluatorWorkspaceTab({
                panel: tab.data.panel,
                title: definition.title,
              });
        },
      }
    );
    const panelIds = Object.keys(layout.panels);
    const savedIds = model == null ? null : collectTabIds(model);
    if (
      model == null ||
      savedIds == null ||
      savedIds.size !== panelIds.length ||
      !panelIds.every((id) => savedIds.has(id))
    ) {
      return layout.defaultModel;
    }
    return model;
  } catch {
    return layout.defaultModel;
  }
}
