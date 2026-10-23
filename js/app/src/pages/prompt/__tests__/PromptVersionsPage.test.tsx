import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadQuery, RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { TagPromptVersionButton } from "@phoenix/components/prompt/TagPromptVersionButton";
import { ThemeProvider } from "@phoenix/contexts";

import type { promptLoaderQuery as promptLoaderQueryType } from "../__generated__/promptLoaderQuery.graphql";
import { promptLoaderQuery } from "../promptLoader";
import { PromptVersionsPage } from "../PromptVersionsPage";

installTestMatchMedia();
installTestStorage();

const PROMPT_ID = "UHJvbXB0OjE=";
const TOTAL_VERSIONS = 120;
const DEFAULT_PAGE_SIZE = 50; // `Prompt.promptVersions(first: Int = 50)`
const PRODUCTION_TAG = { id: "tag-production", name: "production" };

// The real `promptLoaderQuery` is loaded against the test environment below
let queryRef: ReturnType<typeof loadQuery<promptLoaderQueryType>>;
vi.mock("../usePromptIdLoader", () => ({
  usePromptIdLoader: () => ({ queryRef }),
}));

const getVersionId = (sequenceNumber: number) => `version-${sequenceNumber}`;

// Stand-in for `Prompt.promptVersions`: newest first, cursors are offsets
function serveVersions(variables: {
  first?: number | null;
  after?: string | null;
  productionTagVersionId: string;
}) {
  const newestFirst = Array.from({ length: TOTAL_VERSIONS }, (_, index) => {
    const sequenceNumber = TOTAL_VERSIONS - index;
    return {
      cursor: String(index),
      node: {
        __typename: "PromptVersion",
        id: getVersionId(sequenceNumber),
        description: `description ${sequenceNumber}`,
        sequenceNumber,
        createdAt: "2026-01-01T00:00:00Z",
        user: null,
        tags:
          getVersionId(sequenceNumber) === variables.productionTagVersionId
            ? [PRODUCTION_TAG]
            : [],
      },
    };
  });
  const start = variables.after != null ? Number(variables.after) + 1 : 0;
  const first = variables.first ?? DEFAULT_PAGE_SIZE;
  const page = newestFirst.slice(start, start + first);
  return {
    pageInfo: {
      hasNextPage: start + first < TOTAL_VERSIONS,
      endCursor: page[page.length - 1]?.cursor ?? null,
    },
    // the page's fragments read the node both as `node` and as `version: node`
    edges: page.map(({ cursor, node }) => ({ cursor, node, version: node })),
  };
}

function createTestEnvironment() {
  // The newest version starts out holding the "production" tag
  let productionTagVersionId = getVersionId(TOTAL_VERSIONS);
  return new Environment({
    network: Network.create((operation, variables) =>
      Observable.create((sink) => {
        if (operation.name === "TagPromptVersionButtonTagsQuery") {
          const isTagged = variables.versionId === productionTagVersionId;
          const prompt = {
            __typename: "Prompt",
            id: PROMPT_ID,
            versionTags: [PRODUCTION_TAG],
          };
          const promptVersion = {
            __typename: "PromptVersion",
            id: variables.versionId,
            tags: isTagged ? [PRODUCTION_TAG] : [],
          };
          sink.next({ data: { prompt, promptVersion } });
        } else if (operation.name === "TagPromptVersionButtonSetTagMutation") {
          productionTagVersionId = variables.input.promptVersionId;
          sink.next({
            data: { setPromptVersionTag: { promptVersionTag: PRODUCTION_TAG } },
          });
        } else {
          const prompt = {
            __typename: "Prompt",
            id: PROMPT_ID,
            name: "my-prompt",
            // unaliased for selections without arguments (server default of 50)
            promptVersions: serveVersions({ productionTagVersionId }),
            pagedVersions: serveVersions({
              first: variables.first,
              after: variables.after,
              productionTagVersionId,
            }),
          };
          sink.next({ data: { prompt, node: prompt } });
        }
        sink.complete();
      })
    ),
    store: new Store(new RecordSource()),
  });
}

let container: HTMLDivElement;
let root: Root;
let unexpectedWarnings: string[];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  unexpectedWarnings = [];
  // The fake server omits fields of fragments these tests don't render
  vi.spyOn(console, "warn").mockImplementation((message: unknown) => {
    if (!String(message).includes("Payload did not contain a value")) {
      unexpectedWarnings.push(String(message));
    }
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function renderVersionsPage({
  taggedVersionId,
}: { taggedVersionId?: string } = {}) {
  const environment = createTestEnvironment();
  queryRef = loadQuery<promptLoaderQueryType>(environment, promptLoaderQuery, {
    id: PROMPT_ID,
  });
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <MemoryRouter initialEntries={[`/prompts/${PROMPT_ID}/versions`]}>
            <Routes>
              <Route
                path="/prompts/:promptId/versions"
                element={
                  <Suspense fallback={<div>loading</div>}>
                    <PromptVersionsPage />
                    {taggedVersionId && (
                      <TagPromptVersionButton
                        promptId={PROMPT_ID}
                        versionId={taggedVersionId}
                      />
                    )}
                  </Suspense>
                }
              />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
}

function getRenderedVersionItems() {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      `a[href^='/prompts/${PROMPT_ID}/versions/']`
    )
  );
}

function getVersionItemText(versionId: string) {
  return container.querySelector(`a[href$='/${versionId}']`)?.textContent;
}

/**
 * Scroll the list to the bottom until every page is loaded, as a user does to
 * see older versions.
 */
async function loadAllVersions() {
  for (let page = 0; page < 5; page++) {
    const items = getRenderedVersionItems();
    let element = items[items.length - 1]?.parentElement;
    await act(async () => {
      for (; element; element = element.parentElement) {
        Object.defineProperties(element, {
          scrollHeight: { configurable: true, value: 10_000 },
          clientHeight: { configurable: true, value: 800 },
        });
        element.scrollTop = 10_000 - 800;
        element.dispatchEvent(new Event("scroll"));
      }
    });
  }
}

describe("PromptVersionsPage", () => {
  it("lists every version of a prompt that has more than 50 versions", async () => {
    await renderVersionsPage();

    expect(getRenderedVersionItems()).toHaveLength(DEFAULT_PAGE_SIZE);

    await loadAllVersions();

    expect(getRenderedVersionItems()).toHaveLength(TOTAL_VERSIONS);
    expect(getVersionItemText(getVersionId(1))).toBeDefined();
    expect(unexpectedWarnings).toEqual([]);
  });

  it("keeps older versions loaded when a tag is moved to one of them", async () => {
    const olderVersionId = getVersionId(80);
    await renderVersionsPage({ taggedVersionId: olderVersionId });
    await loadAllVersions();
    expect(getRenderedVersionItems()).toHaveLength(TOTAL_VERSIONS);
    expect(getVersionItemText(getVersionId(TOTAL_VERSIONS))).toContain(
      PRODUCTION_TAG.name
    );

    const user = userEvent.setup();
    const tagVersionButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Tag Version")
    );
    await act(async () => {
      await user.click(tagVersionButton!);
    });
    const productionCheckbox = await vi.waitFor(() => {
      const checkbox = document.querySelector<HTMLInputElement>(
        `input[name='${PRODUCTION_TAG.name}']`
      );
      expect(checkbox).not.toBeNull();
      return checkbox!;
    });
    await act(async () => {
      await user.click(productionCheckbox);
    });

    expect(getRenderedVersionItems()).toHaveLength(TOTAL_VERSIONS);
    expect(getVersionItemText(olderVersionId)).toContain(PRODUCTION_TAG.name);
    expect(getVersionItemText(getVersionId(TOTAL_VERSIONS))).not.toContain(
      PRODUCTION_TAG.name
    );
  });
});
