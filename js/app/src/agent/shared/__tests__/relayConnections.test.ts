import { ConnectionHandler, type Environment } from "relay-runtime";
import { describe, expect, it } from "vitest";

import {
  DATASET_LABEL_CONNECTION_KEYS,
  getRootConnectionIds,
} from "../relayConnections";

function environmentWith(recordIds: string[]): Environment {
  const ids = new Set(recordIds);
  return {
    getStore: () => ({
      getSource: () => ({ has: (id: string) => ids.has(id) }),
    }),
  } as unknown as Environment;
}

describe("getRootConnectionIds", () => {
  it("returns only the root connections that exist in the store", () => {
    const [mounted, ...unmounted] = DATASET_LABEL_CONNECTION_KEYS;
    const mountedId = ConnectionHandler.getConnectionID("client:root", mounted);
    const environment = environmentWith([mountedId, "client:root"]);

    expect(
      getRootConnectionIds(DATASET_LABEL_CONNECTION_KEYS, environment)
    ).toEqual([mountedId]);
    expect(getRootConnectionIds(unmounted, environment)).toEqual([]);
  });

  it("returns nothing when no listed connection has been rendered yet", () => {
    expect(
      getRootConnectionIds(DATASET_LABEL_CONNECTION_KEYS, environmentWith([]))
    ).toEqual([]);
  });
});
