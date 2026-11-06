import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type * as ReactRouter from "react-router";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import {
  AddProjectEvaluatorMenu,
  BuildProjectEvaluatorMenu,
} from "../AddProjectEvaluatorMenu";

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => navigate,
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useLazyLoadQuery: () => ({
    evaluators: {
      edges: [
        {
          evaluator: {
            __typename: "LLMEvaluator",
            id: "llm-1",
            name: "correctness",
            description: null,
            kind: "LLM",
          },
        },
      ],
      pageInfo: { hasNextPage: false },
    },
  }),
}));

vi.mock("@phoenix/pages/project/evaluators/projectEvaluatorPaths", () => ({
  useProjectEvaluatorPaths: () => ({ gallery: () => "/gallery" }),
  useProjectEvaluatorCreationPaths: () => ({
    newLlm: "/new/llm",
    newCode: "/new/code",
    newDecision: "/new/decision",
    copyLlm: (id: string) => `/new/copy-llm/${id}`,
    copyCode: (id: string) => `/new/copy-code/${id}`,
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
    navigate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
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

  it("titles sections by kind and offers only the existing evaluators there are", async () => {
    await render(
      <AddProjectEvaluatorMenu
        size="M"
        shouldShowGalleryLink={false}
        defaultOpen
      />
    );
    const sectionTitles = Array.from(
      document.querySelectorAll('[role="menu"] header')
    ).map((header) => header.textContent);
    expect(sectionTitles).toEqual(["LLM", "Code", "Decision"]);
    // There is an LLM evaluator to copy, but no code or decision evaluator
    // to use or copy.
    expect(getMenuItemNames()).toEqual([
      "New LLM evaluator",
      "Copy existing LLM evaluator",
      "New code evaluator",
      "New decision evaluator",
    ]);
  });
});
