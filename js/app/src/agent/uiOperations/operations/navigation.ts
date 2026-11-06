import { navigationGoToInputSchema } from "@phoenix/agent/tools/navigation/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";

/**
 * Navigation as a state-changing operation. The handler registers
 * at the app root, so the operation is available from every page — exactly
 * right, since its job is to be reachable when the operation the script
 * wants is not. Like every other state-changing operation it is covered by
 * the script-level approval: the user consents to the script's
 * `write_description` (which should mention the navigation) before the
 * script runs, and the navigation then applies without a second per-call
 * card.
 */
export const navigationGoToOperation = defineUIOperation({
  name: "navigation.goTo",
  description:
    "Navigate the user to another Phoenix page. The promise resolves after the route change " +
    "commits, so the destination page's operations can register. `path` must match a route " +
    "from get_route_info — a path outside the route catalog is rejected. Use this when an " +
    "operation you need is not available on the current page, then retry that operation. " +
    "Navigation changes state, so the calling script must carry a write_description that " +
    "mentions the destination.",
  inputSchema: navigationGoToInputSchema,
  operationKind: "approval",
  requireSession: true,
  UIBehavior: {
    scrollIntoViewOnMount: true,
  },
});

/** All navigation operations, for catalog assembly and root registration. */
export const navigationOperations: UIOperationDescriptor[] = [
  navigationGoToOperation,
];
