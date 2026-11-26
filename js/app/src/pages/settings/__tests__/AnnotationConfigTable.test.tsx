import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { AnnotationConfigTable } from "../AnnotationConfigTable";
import type { AnnotationConfigTableTestQuery } from "./__generated__/AnnotationConfigTableTestQuery.graphql";

function AnnotationConfigTableTestRenderer({
  onEditAnnotationConfig = () => {},
}: {
  onEditAnnotationConfig?: () => void;
}) {
  const data = useLazyLoadQuery<AnnotationConfigTableTestQuery>(
    graphql`
      query AnnotationConfigTableTestQuery @relay_test_operation {
        ...AnnotationConfigTableFragment
      }
    `,
    {}
  );
  return (
    <AnnotationConfigTable
      annotationConfigs={data}
      onEditAnnotationConfig={onEditAnnotationConfig}
      onDeleteAnnotationConfig={() => {}}
    />
  );
}

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderTable() {
  const environment = createMockEnvironment();
  /** Renders the table, or re-renders it, with the given edit handler */
  const render = (onEditAnnotationConfig?: () => void) =>
    act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <Suspense fallback="loading">
              <AnnotationConfigTableTestRenderer
                onEditAnnotationConfig={onEditAnnotationConfig}
              />
            </Suspense>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  await render();
  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        AnnotationConfigConnection: () => ({
          edges: [
            {
              annotationConfig: {
                __typename: "CategoricalAnnotationConfig",
                id: "config-1",
                name: "correctness",
                annotationType: "CATEGORICAL",
                optimizationDirection: "MAXIMIZE",
                values: [{ label: "correct", score: 1 }],
              },
            },
            {
              annotationConfig: {
                __typename: "FreeformAnnotationConfig",
                id: "config-2",
                name: "reviewer_notes",
                annotationType: "FREEFORM",
                optimizationDirection: "NONE",
              },
            },
          ],
        }),
      })
    );
  });
  return { rerender: render };
}

describe("AnnotationConfigTable", () => {
  it("shows an edit button on every row", async () => {
    await renderTable();

    expect(
      container.querySelector("button[aria-label='Edit correctness']")
    ).not.toBeNull();
    expect(
      container.querySelector("button[aria-label='Edit reviewer_notes']")
    ).not.toBeNull();
  });

  it("opens the edit dialog for a row without selecting it first", async () => {
    await renderTable();
    const user = userEvent.setup();

    const editButton = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Edit correctness']"
    );
    expect(editButton).not.toBeNull();
    await user.click(editButton!);

    expect(document.body.textContent).toContain("Edit Annotation Config");
    const nameInput =
      document.querySelector<HTMLInputElement>("input[name='name']");
    expect(nameInput?.value).toBe("correctness");
    expect(document.body.textContent).not.toContain("selected");
  });

  it("keeps a row's edit dialog open when the edit handler changes", async () => {
    // The page passes a new handler on every render, e.g. when Save starts the mutation
    const { rerender } = await renderTable();
    const user = userEvent.setup();

    await user.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='Edit correctness']"
      )!
    );
    expect(document.body.textContent).toContain("Edit Annotation Config");

    await rerender(() => {});

    expect(document.body.textContent).toContain("Edit Annotation Config");
  });
});
