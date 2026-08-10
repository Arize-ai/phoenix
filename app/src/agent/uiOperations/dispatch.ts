import { z } from "zod";

import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  getMountedUiOperationHandler,
  getUiOperationDescriptor,
  suggestUiOperationNames,
} from "./catalog";

/**
 * Execute one operation call on behalf of a running `execute_ui` script.
 *
 * This is the single choke point every scripted effect flows through:
 * catalog lookup → mounted check → schema validation → handler invocation.
 * It is the relocated core of `defineClientActionTool`'s execute path, run
 * once per `ui.*` call instead of once per tool call.
 *
 * Every failure mode returns an actionable `{ ok: false }` result (never
 * throws), so the calling script can branch on errors and the model can
 * recover — e.g. by calling `search_ui` after an unknown-operation error.
 *
 * RFC scope note: the real implementation also enforces the descriptor's
 * `requiredCapabilities` / `requireSession` here, composing the same guards
 * `defineClientActionTool` uses today (`requireToolSession`, the kernel
 * capability gate). Omitted here to keep the RFC reviewable.
 */
export async function dispatchUiOperationCall({
  operationName,
  input,
}: {
  operationName: string;
  input: unknown;
}): Promise<AgentClientActionResult> {
  const descriptor = getUiOperationDescriptor(operationName);
  if (descriptor == null) {
    const suggestions = suggestUiOperationNames(operationName).join(", ");
    return {
      ok: false,
      error:
        `Unknown operation "${operationName}". Known operations: ${suggestions}. ` +
        "Use search_ui to discover operations and their signatures.",
    };
  }

  const handler = getMountedUiOperationHandler(operationName);
  if (handler == null) {
    const routeHint = descriptor.availability?.routeHint;
    return {
      ok: false,
      error:
        `Operation "${operationName}" is not available on the current page` +
        (routeHint ? `; it requires ${routeHint}.` : "."),
    };
  }

  const parsed = descriptor.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid input for "${operationName}": ${z.prettifyError(parsed.error)}`,
    };
  }

  try {
    const result = await handler(parsed.data);
    if (result.ok && result.output == null) {
      return { ok: true, output: descriptor.defaultSuccessOutput ?? "Done." };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
