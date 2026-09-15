import type { EvaluatorTaskAgentHost } from "@phoenix/agent/tools/playgroundEvaluator/types";

import { createLatestValue } from "./latestValue";

export type EvaluatorTaskAgentRegistry = {
  get: (instanceId: number) => EvaluatorTaskAgentHost | undefined;
  /** The instance's adapter, once its editor registers one; null on timeout. */
  waitFor: (
    instanceId: number,
    timeoutMs: number
  ) => Promise<EvaluatorTaskAgentHost | null>;
  /** Registers the adapter; the returned function withdraws it. */
  register: (instanceId: number, host: EvaluatorTaskAgentHost) => () => void;
};

/**
 * The PXI adapters of the mounted evaluator task editors, by instance id.
 * An operation that has just changed an instance's task awaits the adapter
 * its editor registers instead of polling for it.
 */
export function createEvaluatorTaskAgentRegistry(): EvaluatorTaskAgentRegistry {
  const hosts = createLatestValue<ReadonlyMap<number, EvaluatorTaskAgentHost>>(
    new Map()
  );

  return {
    get: (instanceId) => hosts.get().get(instanceId),
    async waitFor(instanceId, timeoutMs) {
      const all = await hosts.waitFor(
        (current) => current.has(instanceId),
        timeoutMs
      );
      return all?.get(instanceId) ?? null;
    },
    register(instanceId, host) {
      hosts.set(new Map(hosts.get()).set(instanceId, host));
      return () => {
        // A newer registration for the same instance owns the entry now.
        if (hosts.get().get(instanceId) !== host) return;
        const next = new Map(hosts.get());
        next.delete(instanceId);
        hosts.set(next);
      };
    },
  };
}
