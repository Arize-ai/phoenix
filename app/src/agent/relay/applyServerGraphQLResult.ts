/**
 * Writes server-side GraphQL execution results (streamed to the browser over
 * the agent chat data stream) into the singleton Relay store. The server
 * executes the operation and sends back `{query, variables, data, errors,
 * operationType}`; this module rebuilds a ConcreteRequest from the query text
 * + response shape and commits the payload so the UI's existing fragments and
 * subscriptions observe the new data.
 */

import type { Disposable } from "relay-runtime";
import { createOperationDescriptor } from "relay-runtime";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { buildConcreteRequest } from "./buildConcreteRequest";
import { resolveAgentConnections } from "./connectionRegistry";

export type ServerGraphQLResult = {
  query: string;
  /** May be absent on the wire: the stream part schema marks it optional. */
  variables?: Record<string, unknown> | null;
  /** May be absent on the wire; absent/non-object data is a no-op. */
  data?: unknown;
  errors?: unknown;
  operationType: "query" | "mutation";
};

/**
 * Operations already retained, keyed by request identifier. Retaining pins the
 * committed data against Relay GC; deduping avoids stacking a disposable per
 * repeated execution of the same operation + variables.
 */
const retainedOperations = new Map<string, Disposable>();

function isPayloadObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Commit one server-side GraphQL result into the singleton Relay store and
 * retain it. No-ops when `data` is absent or not an object. Never throws: it
 * runs inside a stream callback where an exception would tear down the whole
 * chat stream, so failures are logged and swallowed.
 */
export function applyServerGraphQLResult(result: ServerGraphQLResult): void {
  try {
    const { data } = result;
    if (!isPayloadObject(data)) {
      return;
    }
    const request = buildConcreteRequest({
      queryText: result.query,
      data,
      operationKind: result.operationType,
      resolveConnections: resolveAgentConnections,
    });
    const operation = createOperationDescriptor(
      request,
      result.variables ?? {}
    );
    RelayEnvironment.commitPayload(operation, data);
    const identifier = operation.request.identifier;
    if (!retainedOperations.has(identifier)) {
      retainedOperations.set(identifier, RelayEnvironment.retain(operation));
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[agent relay] Failed to apply server GraphQL result to the Relay store:",
      error
    );
  }
}
