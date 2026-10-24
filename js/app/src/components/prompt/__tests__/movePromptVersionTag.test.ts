import { commitLocalUpdate } from "react-relay";
import {
  createOperationDescriptor,
  Environment,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";
import { describe, expect, it } from "vitest";

import PromptVersionsListPaginationQuery from "@phoenix/pages/prompt/__generated__/PromptVersionsListPaginationQuery.graphql";

import { movePromptVersionTag } from "../movePromptVersionTag";

const PROMPT_ID = "prompt-1";
const PRODUCTION_TAG = { id: "tag-production", name: "production" };
const STAGING_TAG = { id: "tag-staging", name: "staging" };

function versionEdge({
  sequenceNumber,
  tags,
}: {
  sequenceNumber: number;
  tags: (typeof PRODUCTION_TAG)[];
}) {
  const version = {
    __typename: "PromptVersion",
    id: `version-${sequenceNumber}`,
    description: null,
    sequenceNumber,
    createdAt: "2026-01-01T00:00:00Z",
    user: null,
    tags,
  };
  return { cursor: `cursor-${sequenceNumber}`, version, node: version };
}

/**
 * Loads two pages of the versions list into the store the way
 * `PromptVersionsList` does, so the second page is only reachable through the
 * connection: version 3 holds "production", version 1 holds "staging".
 */
function createEnvironmentWithTwoLoadedPages() {
  const environment = new Environment({
    network: Network.create(() => {
      throw new Error("the store update must not fetch");
    }),
    store: new Store(new RecordSource()),
  });
  const pages = [
    {
      after: null,
      edges: [
        versionEdge({ sequenceNumber: 3, tags: [PRODUCTION_TAG] }),
        versionEdge({ sequenceNumber: 2, tags: [] }),
      ],
      hasNextPage: true,
    },
    {
      after: "cursor-2",
      edges: [versionEdge({ sequenceNumber: 1, tags: [STAGING_TAG] })],
      hasNextPage: false,
    },
  ];
  for (const { after, edges, hasNextPage } of pages) {
    environment.commitPayload(
      createOperationDescriptor(PromptVersionsListPaginationQuery, {
        id: PROMPT_ID,
        first: 2,
        after,
      }),
      {
        node: {
          __typename: "Prompt",
          id: PROMPT_ID,
          pagedVersions: {
            edges,
            pageInfo: {
              endCursor: edges[edges.length - 1].cursor,
              hasNextPage,
            },
          },
        },
      }
    );
  }
  return environment;
}

function getTagNamesByVersionId(environment: Environment) {
  const tagNamesByVersionId: Record<string, string[]> = {};
  commitLocalUpdate(environment, (store) => {
    for (const versionId of ["version-3", "version-2", "version-1"]) {
      tagNamesByVersionId[versionId] = (
        store.get(versionId)?.getLinkedRecords("tags") ?? []
      ).map((tag) => String(tag?.getValue("name")));
    }
  });
  return tagNamesByVersionId;
}

describe("movePromptVersionTag", () => {
  it("moves the tag onto a version on a later page and off its previous version", () => {
    const environment = createEnvironmentWithTwoLoadedPages();

    commitLocalUpdate(environment, (store) =>
      movePromptVersionTag({
        store,
        promptId: PROMPT_ID,
        versionId: "version-1",
        tagId: PRODUCTION_TAG.id,
      })
    );

    expect(getTagNamesByVersionId(environment)).toEqual({
      "version-3": [],
      "version-2": [],
      "version-1": ["staging", "production"],
    });
  });

  it("does not duplicate a tag the version already holds", () => {
    const environment = createEnvironmentWithTwoLoadedPages();

    commitLocalUpdate(environment, (store) =>
      movePromptVersionTag({
        store,
        promptId: PROMPT_ID,
        versionId: "version-3",
        tagId: PRODUCTION_TAG.id,
      })
    );

    expect(getTagNamesByVersionId(environment)).toEqual({
      "version-3": ["production"],
      "version-2": [],
      "version-1": ["staging"],
    });
  });
});
