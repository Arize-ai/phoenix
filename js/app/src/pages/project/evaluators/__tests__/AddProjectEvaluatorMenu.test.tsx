import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type * as ReactRouter from "react-router";
import { userEvent, waitFor } from "storybook/test";

import { ViewlessKeyboardEvent } from "@phoenix/__tests__/ViewlessKeyboardEvent";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import {
  AddProjectEvaluatorMenu,
  BuildProjectEvaluatorMenu,
} from "../AddProjectEvaluatorMenu";

const { navigate, evaluatorEdges, queryVariables } = vi.hoisted(() => ({
  navigate: vi.fn(),
  evaluatorEdges: { current: [] as EvaluatorEdge[] },
  queryVariables: [] as EvaluatorQueryVariables[],
}));

type EvaluatorEdge = ReturnType<typeof evaluatorEdge>;
type EvaluatorQueryVariables = {
  kinds: string[];
  filter: { col: string; value: string } | null;
  excludeProjectId: string | null;
};

const CURRENT_PROJECT = { id: "project-1", name: "checkout-agent" };
const OTHER_PROJECT = { id: "project-2", name: "support-bot" };

/** A query result edge for an evaluator used in the given projects. */
function evaluatorEdge({
  usedIn = [OTHER_PROJECT],
  kind,
  ...evaluator
}: {
  id: string;
  name: string;
  kind: string;
  usedIn?: ReadonlyArray<{ id: string; name: string }>;
}) {
  return {
    kind,
    evaluator: {
      ...evaluator,
      description: null,
      projects: { edges: usedIn.map((project) => ({ project })) },
      datasets: { edges: [] },
    },
  };
}

const llmEdge = evaluatorEdge({
  id: "llm-1",
  name: "correctness",
  kind: "LLM",
});
const decisionEdge = evaluatorEdge({
  id: "decision-1",
  name: "relevance",
  kind: "DECISION",
});

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => navigate,
  useParams: () => ({ projectId: CURRENT_PROJECT.id }),
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  // Mimics the server's kind, name and project filters.
  useLazyLoadQuery: (_query: unknown, variables: EvaluatorQueryVariables) => {
    queryVariables.push(variables);
    return {
      evaluators: {
        edges: evaluatorEdges.current.filter(
          (edge) =>
            variables.kinds.includes(edge.kind) &&
            (variables.filter == null ||
              edge.evaluator.name.includes(variables.filter.value)) &&
            !edge.evaluator.projects.edges.some(
              ({ project }) => project.id === variables.excludeProjectId
            )
        ),
        pageInfo: { hasNextPage: false },
      },
    };
  },
}));

vi.mock("@phoenix/pages/project/evaluators/projectEvaluatorPaths", () => ({
  useProjectEvaluatorPaths: () => ({ gallery: () => "/gallery" }),
  useProjectEvaluatorCreationPaths: () => ({
    newLlm: "/new/llm",
    newCode: "/new/code",
    newDecision: "/new/decision",
    copyLlm: (id: string) => `/new/copy-llm/${id}`,
    copyCode: (id: string) => `/new/copy-code/${id}`,
    copyDecision: (id: string) => `/new/copy-decision/${id}`,
    attach: (id: string) => `/new/attach/${id}`,
  }),
}));

const getMenuItemNames = () =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map(
    (item) => item.getAttribute("aria-label") ?? item.textContent?.trim()
  );

describe("project evaluator menus", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("KeyboardEvent", ViewlessKeyboardEvent);
    navigate.mockReset();
    queryVariables.length = 0;
    evaluatorEdges.current = [llmEdge];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (children: React.ReactNode) => {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          {children}
        </ThemeContext.Provider>
      );
    });
  };

  const renderMenu = () =>
    render(
      <AddProjectEvaluatorMenu
        size="M"
        shouldShowGalleryLink={false}
        defaultOpen
      />
    );

  it("builds from scratch with one blank evaluator per kind", async () => {
    await render(<BuildProjectEvaluatorMenu size="S" defaultOpen />);
    expect(getMenuItemNames()).toEqual([
      "New LLM evaluator",
      "New code evaluator",
      "New decision evaluator",
    ]);
    const codeItem = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).find((item) => item.textContent?.trim() === "New code evaluator");
    await act(async () => (codeItem as HTMLElement).click());
    expect(navigate).toHaveBeenCalledWith("/new/code");
  });

  it("titles sections by kind and offers every action without fetching evaluators", async () => {
    await renderMenu();
    const sectionTitles = Array.from(
      document.querySelectorAll('[role="menu"] header')
    ).map((header) => header.textContent);
    expect(sectionTitles).toEqual(["LLM", "Code", "Decision"]);
    expect(getMenuItemNames()).toEqual([
      "New LLM evaluator",
      "Copy existing LLM evaluator",
      "New code evaluator",
      "Copy existing code evaluator",
      "Add existing code evaluator",
      "New decision evaluator",
      "Copy existing decision evaluator",
    ]);
    expect(queryVariables).toEqual([]);
  });

  /** Opens a submenu the way a pointer user does. */
  const openSubmenu = async (label: string) => {
    const submenuTrigger = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((item) => item.textContent?.trim() === label);
    expect(submenuTrigger, label).toBeDefined();
    await userEvent.setup().click(submenuTrigger as HTMLElement);
    await waitFor(() =>
      expect(
        document.querySelector(`[role="menu"][aria-label="${label}"]`)
      ).not.toBeNull()
    );
  };
  const getSubmenuItems = (label: string) =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `[role="menu"][aria-label="${label}"] [role="menuitem"]`
      )
    );

  it("fetches only the opened submenu's kind, and says when there are none", async () => {
    await renderMenu();
    const label = "Copy existing decision evaluator";
    await openSubmenu(label);
    expect(queryVariables.map((variables) => variables.kinds)).toEqual(
      queryVariables.map(() => ["DECISION"])
    );
    expect(
      document.querySelector(`[role="menu"][aria-label="${label}"]`)
        ?.textContent
    ).toContain("No decision evaluators yet");
  });

  it("copies a decision evaluator rather than sharing it", async () => {
    evaluatorEdges.current = [decisionEdge];
    await renderMenu();
    await openSubmenu("Copy existing decision evaluator");
    const [decisionItem] = getSubmenuItems("Copy existing decision evaluator");
    expect(decisionItem.textContent).toContain("relevance");
    await userEvent.setup().click(decisionItem);
    expect(navigate).toHaveBeenCalledWith("/new/copy-decision/decision-1");
  });

  it("narrows a copy submenu to the evaluators whose names match the search", async () => {
    evaluatorEdges.current = [
      decisionEdge,
      evaluatorEdge({
        id: "decision-2",
        name: "toxicity",
        kind: "DECISION",
      }),
    ];
    await renderMenu();
    const label = "Copy existing decision evaluator";
    await openSubmenu(label);
    expect(getSubmenuItems(label)).toHaveLength(2);
    const search = document.querySelector<HTMLInputElement>(
      `input[aria-label="Search ${label.toLowerCase()}"]`
    );
    expect(search).not.toBeNull();
    await userEvent.setup().type(search as HTMLInputElement, "tox");
    await waitFor(() => expect(getSubmenuItems(label)).toHaveLength(1));
    expect(getSubmenuItems(label)[0].textContent).toContain("toxicity");
    expect(queryVariables.at(-1)?.filter).toEqual({
      col: "name",
      value: "tox",
    });
  });

  it("says where each evaluator is used, and only adds one this project lacks", async () => {
    evaluatorEdges.current = [
      evaluatorEdge({
        id: "code-here",
        name: "exact_match",
        kind: "CODE",
        usedIn: [CURRENT_PROJECT, OTHER_PROJECT],
      }),
      evaluatorEdge({
        id: "code-elsewhere",
        name: "json_valid",
        kind: "CODE",
      }),
    ];
    await renderMenu();
    await openSubmenu("Copy existing code evaluator");
    expect(
      getSubmenuItems("Copy existing code evaluator").map(
        (item) => item.textContent
      )
    ).toEqual([
      expect.stringContaining("Used in this project, support-bot"),
      expect.stringContaining("Used in support-bot"),
    ]);
    await openSubmenu("Add existing code evaluator");
    const addable = getSubmenuItems("Add existing code evaluator");
    expect(addable).toHaveLength(1);
    expect(addable[0].textContent).toContain("json_valid");
  });
});
