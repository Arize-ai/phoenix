import { describe, expect, it } from "vitest";

import {
  registerAgentConnection,
  resolveAgentConnections,
} from "@phoenix/agent/relay/connectionRegistry";

describe("connectionRegistry", () => {
  it("returns an empty array for unregistered fields", () => {
    expect(resolveAgentConnections("Query", "neverRegistered")).toEqual([]);
  });

  it("resolves a registered connection by parent typename and field name", () => {
    const entry = {
      parentTypename: "Query",
      fieldName: "registryDatasets",
      key: "RegistryTest_datasets",
      filters: ["filter"],
    };
    registerAgentConnection(entry);
    expect(resolveAgentConnections("Query", "registryDatasets")).toEqual([
      entry,
    ]);
    // The parent typename is part of the lookup key.
    expect(resolveAgentConnections("User", "registryDatasets")).toEqual([]);
  });

  it("allows multiple connections per field", () => {
    registerAgentConnection({
      parentTypename: "User",
      fieldName: "registryProjects",
      key: "RegistryTestA_projects",
      filters: null,
    });
    registerAgentConnection({
      parentTypename: "User",
      fieldName: "registryProjects",
      key: "RegistryTestB_projects",
      filters: [],
    });
    const entries = resolveAgentConnections("User", "registryProjects");
    expect(entries.map((entry) => entry.key)).toEqual([
      "RegistryTestA_projects",
      "RegistryTestB_projects",
    ]);
  });

  it("replaces an entry when the same connection key is re-registered", () => {
    registerAgentConnection({
      parentTypename: "Project",
      fieldName: "registryTasks",
      key: "RegistryTest_tasks",
      filters: null,
    });
    registerAgentConnection({
      parentTypename: "Project",
      fieldName: "registryTasks",
      key: "RegistryTest_tasks",
      filters: ["status"],
    });
    const entries = resolveAgentConnections("Project", "registryTasks");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.filters).toEqual(["status"]);
  });
});
