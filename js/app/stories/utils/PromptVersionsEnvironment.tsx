import type { ReactNode } from "react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import type { RecordSourceProxy } from "relay-runtime";
import {
  createOperationDescriptor,
  Environment,
  getRequest,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";

import type { PromptLatestVersionsListFragment$key } from "@phoenix/pages/prompt/__generated__/PromptLatestVersionsListFragment.graphql";
import promptLoaderQuery from "@phoenix/pages/prompt/__generated__/promptLoaderQuery.graphql";
import type { PromptVersionsList__main$key } from "@phoenix/pages/prompt/__generated__/PromptVersionsList__main.graphql";

import type { PromptVersionFixture } from "../constants/promptVersionFixtures";

/** The page size `PromptLatestVersionsList` requests */
const LATEST_VERSIONS_PAGE_SIZE = 5;

const PROMPT_ID = btoa("Prompt:1");

export type PromptVersionsRef = PromptLatestVersionsListFragment$key &
  PromptVersionsList__main$key;

function writeConnection(
  store: RecordSourceProxy,
  key: string,
  versions: PromptVersionFixture[],
  hasNextPage: boolean
) {
  const connection = store.create(
    `client:${PROMPT_ID}:${key}`,
    "PromptVersionConnection"
  );
  const pageInfo = store.create(
    `client:${PROMPT_ID}:${key}:pageInfo`,
    "PageInfo"
  );
  pageInfo.setValue(hasNextPage, "hasNextPage");
  connection.setLinkedRecord(pageInfo, "pageInfo");
  connection.setLinkedRecords(
    versions.map((version, index) => {
      const edge = store.create(
        `client:${PROMPT_ID}:${key}:edges:${index}`,
        "PromptVersionEdge"
      );
      edge.setLinkedRecord(store.get(version.id) ?? null, "node");
      return edge;
    }),
    "edges"
  );
  return connection;
}

function createEnvironment(versions: PromptVersionFixture[]) {
  const environment = new Environment({
    network: Network.create(async () => ({ data: {} })),
    store: new Store(new RecordSource()),
  });
  environment.commitUpdate((store) => {
    for (const version of versions) {
      const record = store.create(version.id, "PromptVersion");
      record.setValue(version.id, "id");
      record.setValue(version.sequenceNumber, "sequenceNumber");
      record.setValue(version.description, "description");
      record.setValue(version.createdAt, "createdAt");
      if (version.user) {
        const user =
          store.get(version.user.id) ?? store.create(version.user.id, "User");
        user.setValue(version.user.id, "id");
        user.setValue(version.user.username, "username");
        user.setValue(version.user.profilePictureUrl, "profilePictureUrl");
        record.setLinkedRecord(user, "user");
      } else {
        record.setValue(null, "user");
      }
      record.setLinkedRecords(
        version.tags.map((tag) => {
          const tagRecord = store.create(tag.id, "PromptVersionTag");
          tagRecord.setValue(tag.id, "id");
          tagRecord.setValue(tag.name, "name");
          return tagRecord;
        }),
        "tags"
      );
    }
    const prompt = store.create(PROMPT_ID, "Prompt");
    prompt.setValue(PROMPT_ID, "id");
    prompt.setLinkedRecord(
      writeConnection(
        store,
        "latestVersions",
        versions.slice(0, LATEST_VERSIONS_PAGE_SIZE),
        versions.length > LATEST_VERSIONS_PAGE_SIZE
      ),
      "promptVersions",
      { first: LATEST_VERSIONS_PAGE_SIZE }
    );
    prompt.setLinkedRecord(
      writeConnection(store, "promptVersions", versions, false),
      "promptVersions"
    );
  });
  return environment;
}

/**
 * Puts a prompt with the given version history in a Relay store and hands
 * the prompt's fragment reference to `children`, the way the prompt page's
 * `promptLoaderQuery` would. No requests leave the story.
 */
export function PromptVersionsEnvironment({
  versions,
  children,
}: {
  versions: PromptVersionFixture[];
  children: (prompt: PromptVersionsRef) => ReactNode;
}) {
  const [environment] = useState(() => createEnvironment(versions));
  const [prompt] = useState(
    () =>
      ({
        __id: PROMPT_ID,
        __fragments: {
          PromptLatestVersionsListFragment: {},
          PromptVersionsList__main: {},
        },
        __fragmentOwner: createOperationDescriptor(
          getRequest(promptLoaderQuery),
          { id: PROMPT_ID }
        ).request,
      }) as unknown as PromptVersionsRef
  );
  return (
    <RelayEnvironmentProvider environment={environment}>
      {children(prompt)}
    </RelayEnvironmentProvider>
  );
}
