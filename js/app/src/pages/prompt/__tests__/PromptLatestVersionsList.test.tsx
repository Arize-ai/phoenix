import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { PromptLatestVersionsList } from "../PromptLatestVersionsList";
import type { PromptLatestVersionsListTestQuery } from "./__generated__/PromptLatestVersionsListTestQuery.graphql";

function PromptLatestVersionsListTestRenderer() {
  const data = useLazyLoadQuery<PromptLatestVersionsListTestQuery>(
    graphql`
      query PromptLatestVersionsListTestQuery @relay_test_operation {
        prompt: node(id: "test-prompt-id") {
          ... on Prompt {
            ...PromptLatestVersionsListFragment
          }
        }
      }
    `,
    {}
  );
  return <PromptLatestVersionsList prompt={data.prompt} />;
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

async function renderLatestVersions({
  versionIds,
  hasNextPage,
}: {
  versionIds: string[];
  hasNextPage: boolean;
}) {
  const environment = createMockEnvironment();
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <MemoryRouter initialEntries={["/prompts/prompt-1"]}>
            <Routes>
              <Route
                path="/prompts/:promptId"
                element={
                  <Suspense fallback="loading">
                    <PromptLatestVersionsListTestRenderer />
                  </Suspense>
                }
              />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  let versionIndex = 0;
  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "Prompt" }),
        PromptVersionConnection: () => ({
          pageInfo: { hasNextPage },
          edges: versionIds.map(() => ({})),
        }),
        PromptVersion: () => {
          const index = versionIndex++;
          return {
            id: versionIds[index],
            sequenceNumber: versionIds.length - index,
            createdAt: "2026-11-01T12:00:00.000Z",
            tags: [],
          };
        },
      })
    );
  });
}

function hrefs() {
  return Array.from(container.querySelectorAll("a")).map((link) =>
    link.getAttribute("href")
  );
}

function timeline() {
  return container.querySelector("ol.timeline");
}

describe("PromptLatestVersionsList", () => {
  it("links each version and the full list to their pages", async () => {
    await renderLatestVersions({
      versionIds: ["version-2", "version-1"],
      hasNextPage: false,
    });

    expect(hrefs()).toEqual([
      "/prompts/prompt-1/versions/version-2",
      "/prompts/prompt-1/versions/version-1",
      "/prompts/prompt-1/versions",
    ]);
  });

  it("fades out only when older versions exist", async () => {
    await renderLatestVersions({
      versionIds: ["version-1"],
      hasNextPage: false,
    });
    expect(timeline()?.getAttribute("data-truncated")).toBe("false");

    await renderLatestVersions({
      versionIds: ["version-6", "version-5"],
      hasNextPage: true,
    });
    expect(timeline()?.getAttribute("data-truncated")).toBe("true");
  });
});
