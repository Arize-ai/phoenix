import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment } from "relay-test-utils";
import { userEvent } from "storybook/test";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { ProjectEvaluatorGalleryModal } from "../ProjectEvaluatorGalleryModal";

installTestMatchMedia();

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

const decisionEvaluator = {
  __typename: "DecisionEvaluator",
  id: "evaluator-1",
  name: "relevance",
};

describe("ProjectEvaluatorGalleryModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderGallery() {
    const environment = createMockEnvironment();
    const resolve = async (
      name: string,
      data: (operation: OperationDescriptor) => object
    ) => {
      const operation = environment.mock
        .getAllOperations()
        .find(({ request }) => request.node.params.name === name);
      expect(operation, name).toBeDefined();
      await act(async () =>
        environment.mock.resolve(operation!, { data: data(operation!) })
      );
    };
    await act(async () =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <MemoryRouter
              initialEntries={["/projects/project-1/evaluators/gallery"]}
            >
              <Routes>
                <Route
                  path="/projects/:projectId/evaluators/gallery/*"
                  element={<ProjectEvaluatorGalleryModal onClose={vi.fn()} />}
                />
              </Routes>
              <CurrentPath />
            </MemoryRouter>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      )
    );
    return { resolve };
  }

  it("lists a saved decision evaluator as Decision and copies it", async () => {
    const { resolve } = await renderGallery();
    await resolve("projectEvaluatorGalleryModalQuery", () => ({
      evaluatorGalleryConfigs: [],
      evaluators: {
        edges: [
          {
            cursor: "cursor-1",
            evaluator: {
              ...decisionEvaluator,
              description: null,
              projects: {
                edges: [{ project: { id: "project-2", name: "support-bot" } }],
              },
              datasets: { edges: [] },
            },
            node: decisionEvaluator,
          },
        ],
        pageInfo: { endCursor: "cursor-1", hasNextPage: false },
      },
    }));

    const card = document.querySelector<HTMLElement>(
      "[aria-label='Evaluators and templates'] [role=option]"
    );
    expect(card?.textContent).toContain("Decision");
    await act(async () => card?.click());
    await resolve("projectEvaluatorDetailsQuery", () => ({
      evaluator: {
        ...decisionEvaluator,
        inputSchema: { properties: { output: {} } },
        scoringPolicy: {
          questions: [
            {
              __typename: "DecisionPredicateScoring",
              name: "relevant",
              optimizationDirection: "MAXIMIZE",
              threshold: 0.5,
            },
          ],
        },
        decisionVersion: {
          id: "version-1",
          decisionId: "decision-1",
          decision: { id: "decision-1", name: "relevance-decision" },
          modelProvider: "TYPESAFE",
          modelName: "jev",
          questions: [
            { __typename: "DecisionPredicateQuestion", name: "relevant" },
          ],
        },
      },
    }));

    const details = document.querySelector("aside");
    expect(details?.textContent).toContain("relevance-decision");
    expect(details?.textContent).toContain("Used in support-bot");
    expect(details?.textContent).toContain("output");
    const buttonLabels = Array.from(
      details?.querySelectorAll("button") ?? []
    ).map((button) => button.textContent);
    expect(buttonLabels).not.toContain("Use this evaluator");
    const copy = Array.from(details?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Copy and edit"
    );
    expect(copy).toBeDefined();
    await act(async () => copy?.click());
    expect(document.querySelector("[data-testid=path]")?.textContent).toMatch(
      /\/new\/copy-decision\/evaluator-1$/
    );
  });

  it("filters evaluators and templates by name", async () => {
    const user = userEvent.setup();
    const { resolve } = await renderGallery();
    const template = {
      description: null,
      details: null,
      choices: {},
      optimizationDirection: "MAXIMIZE",
      scope: "SPAN",
      inputs: [],
      defaultFilterCondition: null,
      defaultPathMapping: null,
      messages: [],
    };
    await resolve("projectEvaluatorGalleryModalQuery", () => ({
      evaluatorGalleryConfigs: [
        { ...template, name: "correctness", category: "RESPONSE_QUALITY" },
        { ...template, name: "tool_selection", category: "AGENTS" },
      ],
      evaluators: {
        edges: [
          {
            cursor: "cursor-1",
            evaluator: { ...decisionEvaluator, description: null },
            node: decisionEvaluator,
          },
        ],
        pageInfo: { endCursor: "cursor-1", hasNextPage: false },
      },
    }));
    const getSectionKeys = () =>
      Array.from(
        document.querySelectorAll(
          "[aria-label='Evaluator gallery sections'] [role=option]"
        ),
        (section) => section.getAttribute("data-key")
      );
    const searchInput = document.querySelector<HTMLInputElement>(
      "input[aria-label='Search evaluators by name']"
    );
    expect(searchInput).not.toBeNull();

    const getCardKeys = () =>
      Array.from(
        document.querySelectorAll(
          "[aria-label='Evaluators and templates'] [role=option][data-key]"
        ),
        (card) => card.getAttribute("data-key")
      );

    await act(async () => user.type(searchInput!, "CORRECT"));
    expect(getCardKeys()).toEqual(["template:correctness"]);
    expect(getSectionKeys()).toEqual(["RESPONSE_QUALITY"]);

    await act(async () => user.type(searchInput!, "zzz"));
    expect(getCardKeys()).toEqual([]);
    expect(
      document.querySelector("[aria-label='Evaluators and templates']")
        ?.textContent
    ).toContain("No results");
  });
});
