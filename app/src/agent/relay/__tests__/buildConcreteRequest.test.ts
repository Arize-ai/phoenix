import {
  Environment,
  Network,
  RecordSource,
  Store,
  createOperationDescriptor,
} from "relay-runtime";
import { describe, expect, it } from "vitest";

import { buildConcreteRequest } from "@phoenix/agent/relay/buildConcreteRequest";
import {
  registerAgentConnection,
  resolveAgentConnections,
} from "@phoenix/agent/relay/connectionRegistry";

/**
 * Fresh environment per test. The network stub throws so any accidental
 * fetch fails loudly; commitPayload never touches the network.
 * treatMissingFieldsAsNull matches how payload-complete server responses
 * should be treated (fields absent from a payload are explicit nulls).
 */
function createTestEnvironment(): Environment {
  return new Environment({
    network: Network.create(() => {
      throw new Error("network should never be called");
    }),
    store: new Store(new RecordSource()),
    treatMissingFieldsAsNull: true,
  });
}

function isIndexable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Navigate untyped nested data (store JSON, reader data, built ASTs). */
function getPath(
  value: unknown,
  path: ReadonlyArray<string | number>
): unknown {
  let current: unknown = value;
  for (const step of path) {
    if (!isIndexable(current)) {
      return undefined;
    }
    current = current[String(step)];
  }
  return current;
}

function readStoreJSON(
  environment: Environment
): Partial<Record<string, Record<string, unknown>>> {
  return environment.getStore().getSource().toJSON();
}

// ---------------------------------------------------------------------------
// Fixture: variables, aliases, list field, literal args (incl. enum literal
// and deliberately non-alphabetical arg order), null scalar, scalar list,
// empty linked list, fragment spread, inline fragment on the concrete type,
// union-style mixed list, and a linked field with no id (client-ID fallback).
// ---------------------------------------------------------------------------

const appQuery = `
  query AppQuery($userId: ID!, $count: Int!) {
    user(id: $userId) {
      id
      __typename
      name
      nickname: name
      projects(orderBy: NAME, first: $count) {
        id
        __typename
        title
        tasks(first: 2) {
          id
          __typename
          label
          done
        }
      }
      avatar(size: 64) {
        id
        __typename
        url
      }
      settings {
        __typename
        theme
      }
      bio
      tags
      contacts {
        __typename
        id
        ... on Human {
          name
        }
        ... on Bot {
          model
        }
        ... on Ghost {
          spooky
        }
      }
      ...UserExtra
      ... on User {
        email
      }
    }
  }
  fragment UserExtra on User {
    createdAt
  }
`;
const appQueryVariables = { userId: "u1", count: 2 };
const appQueryData = {
  user: {
    id: "u1",
    __typename: "User",
    name: "Ada",
    nickname: "Ada",
    projects: [
      {
        id: "p1",
        __typename: "Project",
        title: "Alpha",
        tasks: [
          { id: "t1", __typename: "Task", label: "one", done: true },
          { id: "t2", __typename: "Task", label: "two", done: false },
        ],
      },
      { id: "p2", __typename: "Project", title: "Beta", tasks: [] },
    ],
    avatar: { id: "a1", __typename: "Image", url: "http://x/a.png" },
    settings: { __typename: "Settings", theme: "dark" },
    bio: null,
    tags: ["admin", "dev"],
    contacts: [
      { __typename: "Human", id: "h1", name: "Hank" },
      { __typename: "Bot", id: "b1", model: "gpt" },
    ],
    createdAt: "2020-01-01",
    email: "ada@example.com",
  },
};

function commitAppQuery(environment: Environment) {
  const request = buildConcreteRequest({
    queryText: appQuery,
    data: appQueryData,
    operationKind: "query",
  });
  const operation = createOperationDescriptor(request, appQueryVariables);
  environment.commitPayload(operation, appQueryData);
  return operation;
}

describe("buildConcreteRequest", () => {
  describe("normalization", () => {
    it("normalizes nested data id-keyed with serialized-variable and literal arg storage keys", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const source = readStoreJSON(environment);

      // Root links user via serialized-variable key.
      expect(source["client:root"]?.['user(id:"u1")']).toEqual({
        __ref: "u1",
      });

      const user = source["u1"];
      expect(user?.__typename).toBe("User");
      expect(user?.name).toBe("Ada");

      // Variable + enum args serialized and alphabetized.
      expect(user?.['projects(first:2,orderBy:"NAME")']).toEqual({
        __refs: ["p1", "p2"],
      });
      // Literal-only args get a precomputed storage key.
      expect(user?.["avatar(size:64)"]).toEqual({ __ref: "a1" });
      expect(source["p1"]?.["tasks(first:2)"]).toEqual({
        __refs: ["t1", "t2"],
      });
      // Deep record normalized.
      expect(source["t2"]?.done).toBe(false);
      expect(source["t2"]?.__typename).toBe("Task");
    });

    it("precomputes storageKey only for literal-only args", () => {
      const request = buildConcreteRequest({
        queryText: appQuery,
        data: appQueryData,
        operationKind: "query",
      });
      const userSelections = getPath(request, [
        "operation",
        "selections",
        0,
        "selections",
      ]);
      expect(Array.isArray(userSelections)).toBe(true);
      const selections = userSelections as unknown[];
      const findByName = (name: string) =>
        selections.find((selection) => getPath(selection, ["name"]) === name);
      expect(getPath(findByName("avatar"), ["storageKey"])).toBe(
        "avatar(size:64)"
      );
      // Args containing a variable cannot be precomputed.
      expect(getPath(findByName("projects"), ["storageKey"])).toBeNull();
    });

    it("stores aliases under the schema storage key without duplicate keys", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const user = readStoreJSON(environment)["u1"];
      expect(user).toBeDefined();
      expect(user).not.toHaveProperty("nickname");
    });

    it("stores null scalars explicitly and scalar lists inline", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const user = readStoreJSON(environment)["u1"];
      expect(user?.bio).toBeNull();
      expect(user?.tags).toEqual(["admin", "dev"]);
    });

    it("keeps JSON-ish custom scalar values inline as scalars", () => {
      const queryText = `
        query MetadataQuery {
          user(id: "u1") {
            id
            __typename
            metadata
          }
        }
      `;
      const metadata = { nested: { flags: [1, 2] }, plain: "value" };
      const data = {
        user: { id: "u1", __typename: "User", metadata },
      };
      const environment = createTestEnvironment();
      const request = buildConcreteRequest({
        queryText,
        data,
        operationKind: "query",
      });
      environment.commitPayload(createOperationDescriptor(request, {}), data);
      const user = readStoreJSON(environment)["u1"];
      // Stored as a value, not a { __ref } link.
      expect(user?.metadata).toEqual(metadata);
    });

    it("inlines fragment spreads and applies inline fragments on the concrete type", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const user = readStoreJSON(environment)["u1"];
      expect(user?.createdAt).toBe("2020-01-01");
      expect(user?.email).toBe("ada@example.com");
    });

    it("normalizes union members under their own typenames and keeps non-matching refinements inert", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const source = readStoreJSON(environment);
      expect(source["h1"]?.name).toBe("Hank");
      expect(source["b1"]?.model).toBe("gpt");

      // The Ghost refinement matched nothing: emitted as an inert
      // InlineFragment, and no record ever received `spooky`.
      const request = buildConcreteRequest({
        queryText: appQuery,
        data: appQueryData,
        operationKind: "query",
      });
      const requestJSON = JSON.stringify(request);
      expect(requestJSON).toContain('"type":"Ghost"');
      expect(source["h1"]).not.toHaveProperty("spooky");
      expect(source["b1"]).not.toHaveProperty("spooky");
    });

    it("falls back to client IDs for linked objects without an id", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const source = readStoreJSON(environment);
      expect(source["u1"]?.settings).toEqual({
        __ref: "client:u1:settings",
      });
      expect(source["client:u1:settings"]?.theme).toBe("dark");
    });

    it("normalizes empty linked lists to empty ref lists", () => {
      const environment = createTestEnvironment();
      commitAppQuery(environment);
      const source = readStoreJSON(environment);
      expect(source["p2"]?.["tasks(first:2)"]).toEqual({ __refs: [] });
    });
  });

  describe("reader round-trip", () => {
    it("reads back the full payload with no missing data", () => {
      const environment = createTestEnvironment();
      const operation = commitAppQuery(environment);
      const snapshot = environment.lookup(operation.fragment);
      expect(snapshot.isMissingData).toBe(false);
      expect(getPath(snapshot.data, ["user", "nickname"])).toBe("Ada");
      expect(
        getPath(snapshot.data, ["user", "projects", 0, "tasks", 1, "label"])
      ).toBe("two");
      expect(getPath(snapshot.data, ["user", "projects", 1, "title"])).toBe(
        "Beta"
      );
      // Union fields resolve per typename; non-matching fields stay unset.
      expect(getPath(snapshot.data, ["user", "contacts", 0, "name"])).toBe(
        "Hank"
      );
      expect(
        getPath(snapshot.data, ["user", "contacts", 0, "model"])
      ).toBeUndefined();
      expect(getPath(snapshot.data, ["user", "contacts", 1, "model"])).toBe(
        "gpt"
      );
      // Inlined fragment spread + inline fragment fields.
      expect(getPath(snapshot.data, ["user", "createdAt"])).toBe("2020-01-01");
      expect(getPath(snapshot.data, ["user", "email"])).toBe("ada@example.com");
    });
  });

  describe("cross-query merge", () => {
    it("notifies a subscriber on the first operation when a second operation updates a shared record", () => {
      const environment = createTestEnvironment();
      const operation = commitAppQuery(environment);
      const snapshot = environment.lookup(operation.fragment);

      let notifiedCount = 0;
      let latest: unknown = null;
      environment.subscribe(snapshot, (nextSnapshot) => {
        notifiedCount++;
        latest = nextSnapshot;
      });

      const refreshQuery = `
        query RefreshUserQuery($uid: ID!) {
          user(id: $uid) {
            id
            __typename
            name
          }
        }
      `;
      const refreshData = {
        user: { id: "u1", __typename: "User", name: "Ada Lovelace" },
      };
      const refreshRequest = buildConcreteRequest({
        queryText: refreshQuery,
        data: refreshData,
        operationKind: "query",
      });
      environment.commitPayload(
        createOperationDescriptor(refreshRequest, { uid: "u1" }),
        refreshData
      );

      expect(notifiedCount).toBeGreaterThanOrEqual(1);
      // Name change visible in both the plain field and the alias (same
      // storage key `name`).
      expect(getPath(latest, ["data", "user", "name"])).toBe("Ada Lovelace");
      expect(getPath(latest, ["data", "user", "nickname"])).toBe(
        "Ada Lovelace"
      );
      // Untouched sibling data still intact in the updated snapshot.
      expect(getPath(latest, ["data", "user", "projects", 0, "title"])).toBe(
        "Alpha"
      );
      expect(readStoreJSON(environment)["u1"]?.name).toBe("Ada Lovelace");
    });
  });

  describe("edge cases", () => {
    it("normalizes null linked fields and hoists interface fragment spreads", () => {
      const queryText = `
        query EdgeQuery {
          user(id: "u9") {
            id
            __typename
            bestFriend { id __typename name }
            ...NodeBits
          }
        }
        fragment NodeBits on Node { slug }
      `;
      const data = {
        user: { id: "u9", __typename: "User", bestFriend: null, slug: "s-9" },
      };
      const request = buildConcreteRequest({
        queryText,
        data,
        operationKind: "query",
      });

      // The interface spread's field is present in the data, so it is
      // hoisted into the parent (no InlineFragment wrapper around slug).
      const userSelections = getPath(request, [
        "operation",
        "selections",
        0,
        "selections",
      ]) as unknown[];
      const slugNode = userSelections.find(
        (selection) => getPath(selection, ["name"]) === "slug"
      );
      expect(getPath(slugNode, ["kind"])).toBe("ScalarField");

      const environment = createTestEnvironment();
      const operation = createOperationDescriptor(request, {});
      environment.commitPayload(operation, data);
      const source = readStoreJSON(environment);
      expect(source["u9"]?.bestFriend).toBeNull();
      expect(source["u9"]?.slug).toBe("s-9");

      const snapshot = environment.lookup(operation.fragment);
      expect(snapshot.isMissingData).toBe(false);
      expect(getPath(snapshot.data, ["user", "bestFriend"])).toBeNull();
    });

    it("builds deterministically: identical inputs yield identical requests", () => {
      const first = buildConcreteRequest({
        queryText: appQuery,
        data: appQueryData,
        operationKind: "query",
      });
      const second = buildConcreteRequest({
        queryText: appQuery,
        data: appQueryData,
        operationKind: "query",
      });
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(getPath(first, ["params", "cacheID"])).toBe(
        getPath(second, ["params", "cacheID"])
      );
    });

    it("rejects documents without exactly one operation", () => {
      expect(() =>
        buildConcreteRequest({
          queryText: "fragment F on User { id }",
          data: {},
          operationKind: "query",
        })
      ).toThrow("Expected exactly one operation, got 0");
    });
  });

  describe("connections", () => {
    const connectionQuery = `
      query TestProjectsQuery($first: Int!, $after: String) {
        projects(first: $first, after: $after) {
          __typename
          edges {
            __typename
            cursor
            node {
              id
              __typename
              name
            }
          }
          pageInfo {
            __typename
            endCursor
            hasNextPage
            hasPreviousPage
            startCursor
          }
        }
      }
    `;
    const pageOneData = {
      projects: {
        __typename: "ProjectConnection",
        edges: [
          {
            __typename: "ProjectEdge",
            cursor: "cursor-1",
            node: { id: "p1", __typename: "Project", name: "Alpha" },
          },
          {
            __typename: "ProjectEdge",
            cursor: "cursor-2",
            node: { id: "p2", __typename: "Project", name: "Beta" },
          },
        ],
        pageInfo: {
          __typename: "PageInfo",
          endCursor: "cursor-2",
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "cursor-1",
        },
      },
    };
    const pageTwoData = {
      projects: {
        __typename: "ProjectConnection",
        edges: [
          {
            __typename: "ProjectEdge",
            cursor: "cursor-3",
            node: { id: "p3", __typename: "Project", name: "Gamma" },
          },
          {
            __typename: "ProjectEdge",
            cursor: "cursor-4",
            node: { id: "p4", __typename: "Project", name: "Delta" },
          },
        ],
        pageInfo: {
          __typename: "PageInfo",
          endCursor: "cursor-4",
          hasNextPage: false,
          hasPreviousPage: true,
          startCursor: "cursor-3",
        },
      },
    };

    it("emits LinkedHandle siblings in the operation AST only", () => {
      registerAgentConnection({
        parentTypename: "Query",
        fieldName: "projects",
        key: "TestList_projects",
        filters: [],
      });
      const request = buildConcreteRequest({
        queryText: connectionQuery,
        data: pageOneData,
        operationKind: "query",
        resolveConnections: resolveAgentConnections,
      });

      const operationSelections = getPath(request, [
        "operation",
        "selections",
      ]) as unknown[];
      expect(getPath(operationSelections, [0, "kind"])).toBe("LinkedField");
      expect(getPath(operationSelections, [0, "name"])).toBe("projects");
      // The handle is the immediate sibling of its LinkedField, sharing args.
      expect(getPath(operationSelections, [1])).toEqual({
        alias: null,
        args: getPath(operationSelections, [0, "args"]),
        filters: [],
        handle: "connection",
        key: "TestList_projects",
        kind: "LinkedHandle",
        name: "projects",
      });

      // RelayReader has no LinkedHandle case (it throws on unknown kinds), and
      // compiled artifacts emit LinkedHandle only under `operation`.
      const fragmentSelections = getPath(request, [
        "fragment",
        "selections",
      ]) as unknown[];
      expect(fragmentSelections).toHaveLength(1);
      expect(getPath(fragmentSelections, [0, "kind"])).toBe("LinkedField");
    });

    it("resolves connections against the observed parent typename for nested fields", () => {
      registerAgentConnection({
        parentTypename: "User",
        fieldName: "projects",
        key: "UserProjects_projects",
        filters: null,
      });
      const queryText = `
        query NestedConnectionQuery {
          user(id: "u1") {
            id
            __typename
            projects(first: 2) {
              __typename
              edges { __typename cursor node { id __typename name } }
              pageInfo { __typename endCursor hasNextPage hasPreviousPage startCursor }
            }
          }
        }
      `;
      const data = {
        user: {
          id: "u1",
          __typename: "User",
          projects: pageOneData.projects,
        },
      };
      const request = buildConcreteRequest({
        queryText,
        data,
        operationKind: "query",
        resolveConnections: resolveAgentConnections,
      });
      const userSelections = getPath(request, [
        "operation",
        "selections",
        0,
        "selections",
      ]) as unknown[];
      const handle = userSelections.find(
        (selection) => getPath(selection, ["kind"]) === "LinkedHandle"
      );
      expect(getPath(handle, ["key"])).toBe("UserProjects_projects");
      expect(getPath(handle, ["filters"])).toBeNull();
    });

    it("maintains the connection handle record and appends the second page", () => {
      registerAgentConnection({
        parentTypename: "Query",
        fieldName: "projects",
        key: "TestList_projects",
        filters: [],
      });
      const environment = createTestEnvironment();

      const pageOneRequest = buildConcreteRequest({
        queryText: connectionQuery,
        data: pageOneData,
        operationKind: "query",
        resolveConnections: resolveAgentConnections,
      });
      environment.commitPayload(
        createOperationDescriptor(pageOneRequest, { first: 2, after: null }),
        pageOneData
      );

      const sourceAfterPageOne = readStoreJSON(environment);
      const handleKeys = Object.keys(sourceAfterPageOne).filter((key) =>
        key.includes("__TestList_projects_connection")
      );
      // The connection handle record plus its client pageInfo and edges.
      expect(handleKeys.length).toBeGreaterThan(0);
      const connectionId = "client:root:__TestList_projects_connection";
      expect(
        sourceAfterPageOne["client:root"]?.["__TestList_projects_connection"]
      ).toEqual({ __ref: connectionId });
      const edgesAfterPageOne = getPath(sourceAfterPageOne, [
        connectionId,
        "edges",
        "__refs",
      ]) as string[];
      expect(edgesAfterPageOne).toHaveLength(2);

      // Second page, fetched after page one's endCursor: ConnectionHandler
      // append semantics require args.after to equal the client pageInfo's
      // endCursor, which page one's commit recorded.
      const pageTwoRequest = buildConcreteRequest({
        queryText: connectionQuery,
        data: pageTwoData,
        operationKind: "query",
        resolveConnections: resolveAgentConnections,
      });
      environment.commitPayload(
        createOperationDescriptor(pageTwoRequest, {
          first: 2,
          after: "cursor-2",
        }),
        pageTwoData
      );

      const sourceAfterPageTwo = readStoreJSON(environment);
      const edgesAfterPageTwo = getPath(sourceAfterPageTwo, [
        connectionId,
        "edges",
        "__refs",
      ]) as string[];
      expect(edgesAfterPageTwo).toHaveLength(4);
      const nodeIds = edgesAfterPageTwo.map((edgeId) =>
        getPath(sourceAfterPageTwo, [edgeId, "node", "__ref"])
      );
      expect(nodeIds).toEqual(["p1", "p2", "p3", "p4"]);
      // The client pageInfo advanced to the second page's endCursor.
      const pageInfoRef = getPath(sourceAfterPageTwo, [
        connectionId,
        "pageInfo",
        "__ref",
      ]);
      expect(typeof pageInfoRef).toBe("string");
      expect(
        getPath(sourceAfterPageTwo, [String(pageInfoRef), "endCursor"])
      ).toBe("cursor-4");
      expect(
        getPath(sourceAfterPageTwo, [String(pageInfoRef), "hasNextPage"])
      ).toBe(false);
    });
  });
});
