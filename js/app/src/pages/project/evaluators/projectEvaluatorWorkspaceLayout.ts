import { defineEvaluatorWorkspaceLayout } from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";
import { PROJECT_EVALUATOR_WORKSPACE_STORAGE_KEY } from "@phoenix/constants/storageConstants";

export type ProjectEvaluatorWorkspacePanelId =
  | "prompt"
  | "annotation"
  | "scope"
  | "details"
  | "variables"
  | "records"
  | "inspector";

/**
 * The LLM project evaluator form: the definition on the left with the
 * variable mapping docked under it; the records in scope on the right with
 * the focused record's inspector under them. The lower tabsets collapse to
 * their headers.
 */
export const PROJECT_LLM_EVALUATOR_WORKSPACE_LAYOUT =
  defineEvaluatorWorkspaceLayout<ProjectEvaluatorWorkspacePanelId>({
    storageKey: PROJECT_EVALUATOR_WORKSPACE_STORAGE_KEY,
    panels: {
      prompt: { title: "Prompt" },
      annotation: { title: "Annotation" },
      scope: { title: "Scope" },
      details: { title: "Details" },
      variables: { title: "Variables" },
      // The bench pads its own sides and scrolls its table under a pinned
      // header; the inspector scrolls its own body.
      records: { title: "Records", padding: "top", scroll: "self" },
      inspector: { title: "Inspector", padding: "none", scroll: "self" },
    },
    root: (tab) => ({
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
                tab("prompt"),
                tab("annotation"),
                tab("scope"),
                tab("details"),
              ],
            },
            {
              type: "tabset",
              id: "mapping",
              size: 34,
              collapsible: true,
              minHeight: "96px",
              tabs: [tab("variables")],
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
              tabs: [tab("records")],
            },
            {
              type: "tabset",
              id: "inspect",
              size: 48,
              collapsible: true,
              minHeight: "120px",
              tabs: [tab("inspector")],
            },
          ],
        },
      ],
    }),
  });
