import { matchPath } from "react-router";

import { normalizeInputPath } from "@phoenix/agent/tools/getRouteInfo/parsers";
import { getRegisteredRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/routeCatalogRegistry";
import type { RouteCatalogEntry } from "@phoenix/agent/tools/getRouteInfo/types";
import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import type { UIOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { bindPendingNavigationActions } from "./pendingNavigation";
import type { NavigationGoToInput } from "./types";

/**
 * Resolve a concrete path against the route catalog (the same data
 * `get_route_info` serves). The catalog holds route *patterns*
 * (`/datasets/:datasetId/...`), so matching uses the router's own matcher,
 * not string equality. A path outside the catalog is rejected — the model
 * cannot navigate the user to a guess.
 */
function matchCatalogEntry(path: string): RouteCatalogEntry | null {
  for (const entry of getRegisteredRouteInfoCatalog()) {
    if (matchPath({ path: entry.path, end: true }, path)) {
      return entry;
    }
  }
  return null;
}

/**
 * Handler for the `navigation.goTo` operation. Always registered at the app
 * root — its job is to be reachable when the operation the script actually
 * wants is not. Consent is script-level: when the run holds a script
 * approval grant (the user accepted the script's `write_description`, or
 * bypass edit mode granted the run implicitly), the navigation applies
 * immediately instead of staging its own card.
 */
export function createNavigationGoToClientAction({
  agentStore,
  navigate,
  getCurrentPath,
}: {
  agentStore: AgentStore;
  navigate: (path: string) => void;
  getCurrentPath: () => string;
}): UIOperationHandler<NavigationGoToInput> {
  return (input, context) => {
    const path = normalizeInputPath(input.path);
    const entry = matchCatalogEntry(path);
    if (!entry) {
      return Promise.resolve({
        ok: false,
        error:
          `"${input.path}" does not match any Phoenix route. ` +
          "Use get_route_info to find a valid path first.",
      });
    }
    if (getCurrentPath() === path) {
      return Promise.resolve({
        ok: true,
        output: {
          status: "already_there",
          path,
          message: `The user is already on ${entry.metadata.label} (${path}).`,
        },
      });
    }
    return new Promise((resolve) => {
      const pendingNavigation = bindPendingNavigationActions({
        pendingNavigation: {
          toolCallId: context.callId,
          sessionId: context.sessionId ?? "",
          path,
          label: entry.metadata.label,
          reason: input.reason,
        },
        navigate,
        getCurrentPath,
        emitResult: resolve,
        setPendingNavigation: agentStore.getState().setPendingNavigation,
      });
      if (
        agentStore.getState().permissions.edits === "bypass" ||
        isOperationCallApprovalGranted(context.callId)
      ) {
        void pendingNavigation.accept?.({ approvalSource: "auto" });
        return;
      }
      agentStore
        .getState()
        .setPendingNavigation(context.callId, pendingNavigation);
    });
  };
}
