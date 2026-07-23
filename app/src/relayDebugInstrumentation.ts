import type { Environment, Store } from "relay-runtime";

import { isObject, isStringKeyedObject } from "./typeUtils";

type InstrumentedRelayStore = Store & {
  __gc?: () => void;
};

let relayRetainLogId = 0;

const activeRetainsByIdentifier = new Map<
  string,
  {
    count: number;
    name: string;
  }
>();

export function isRelayDebugEnabled() {
  const debugFlag = import.meta.env.VITE_DEBUG_RELAY?.toLowerCase();
  return (
    import.meta.env.DEV &&
    (debugFlag === "1" || debugFlag === "true" || debugFlag === "yes")
  );
}

function getOperationDetails(operation: unknown) {
  if (!isObject(operation) || !("request" in operation)) {
    return null;
  }
  const request: unknown = operation.request;
  if (!isStringKeyedObject(request)) {
    return null;
  }

  const requestObject = request;
  const node = requestObject.node;
  const params =
    isStringKeyedObject(node) && isStringKeyedObject(node.params)
      ? node.params
      : null;

  return {
    identifier:
      typeof requestObject.identifier === "string"
        ? requestObject.identifier
        : "unknown",
    name: params && typeof params.name === "string" ? params.name : "unknown",
    variables: isObject(requestObject.variables)
      ? requestObject.variables
      : undefined,
  };
}

function trackRetain({
  identifier,
  name,
}: {
  identifier: string;
  name: string;
}) {
  const existing = activeRetainsByIdentifier.get(identifier);
  if (existing) {
    existing.count += 1;
    return;
  }

  activeRetainsByIdentifier.set(identifier, {
    count: 1,
    name,
  });
}

function untrackRetain(identifier: string) {
  const existing = activeRetainsByIdentifier.get(identifier);
  if (!existing) {
    return;
  }

  existing.count -= 1;
  if (existing.count <= 0) {
    activeRetainsByIdentifier.delete(identifier);
  }
}

function formatActiveRetains({ loaderOnly = false }: { loaderOnly?: boolean }) {
  const lines = Array.from(activeRetainsByIdentifier.entries())
    .filter(([, value]) =>
      loaderOnly ? value.name.endsWith("LoaderQuery") : true
    )
    .sort(([, left], [, right]) => left.name.localeCompare(right.name))
    .map(
      ([identifier, value]) => `${value.name} x${value.count} (${identifier})`
    );

  return lines.length > 0 ? lines : ["(none)"];
}

function logActiveRetains() {
  debugLog("[relay] active retains", formatActiveRetains({}));
  debugLog(
    "[relay] active loader retains",
    formatActiveRetains({ loaderOnly: true })
  );
}

function debugLog(message: string, ...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.debug(message, ...args);
}

function infoLog(message: string, ...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.info(message, ...args);
}

function instrumentRelayRetain(environment: Environment) {
  const originalRetain = environment.retain.bind(environment);

  environment.retain = ((operation) => {
    const retainId = ++relayRetainLogId;
    const operationDetails = getOperationDetails(operation);
    const operationIdentifier =
      operationDetails?.identifier ?? `unknown-${retainId}`;
    const operationName = operationDetails?.name ?? "unknown";

    trackRetain({
      identifier: operationIdentifier,
      name: operationName,
    });

    debugLog(`[relay] retain ${operationName}`, {
      operation: operationDetails,
      retainId,
    });
    logActiveRetains();

    const disposable = originalRetain(operation);

    return {
      dispose() {
        untrackRetain(operationIdentifier);
        debugLog(`[relay] dispose ${operationName}`, {
          operation: operationDetails,
          retainId,
        });
        logActiveRetains();
        disposable.dispose();
      },
    };
  }) as typeof environment.retain;
}

function instrumentRelayGC(store: InstrumentedRelayStore) {
  const originalGC = store.__gc?.bind(store);

  if (!originalGC) {
    return;
  }

  store.__gc = () => {
    debugLog("[relay] store.__gc");
    originalGC();
  };
}

/**
 * Enables local Relay retain/GC logging when `VITE_DEBUG_RELAY=true`.
 */
export function instrumentRelayEnvironment({
  environment,
  store,
}: {
  environment: Environment;
  store: Store;
}) {
  infoLog(
    "[relay] Relay debug logging enabled. Retain/dispose logs use console.debug; if you do not see them, enable Verbose in your browser devtools console."
  );
  instrumentRelayRetain(environment);
  instrumentRelayGC(store as InstrumentedRelayStore);
}
