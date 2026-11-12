import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  createReadProjectEvaluatorBenchClientAction,
  createRunProjectEvaluatorBenchClientAction,
  type ProjectEvaluatorBenchHost,
} from "@phoenix/agent/tools/projectEvaluatorBench";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  readProjectEvaluatorBenchOperation,
  runProjectEvaluatorBenchOperation,
} from "@phoenix/agent/uiOperations/operations/projectEvaluator";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** Where the mounted bench publishes itself for the bench operations. */
export type ProjectEvaluatorBenchRegistry = {
  get: () => ProjectEvaluatorBenchHost | null;
  /** Publishes a host; returns the matching unpublish. */
  publish: (host: ProjectEvaluatorBenchHost) => () => void;
};

function createBenchRegistry(): ProjectEvaluatorBenchRegistry {
  let current: ProjectEvaluatorBenchHost | null = null;
  return {
    get: () => current,
    publish: (host) => {
      current = host;
      return () => {
        if (current === host) {
          current = null;
        }
      };
    },
  };
}

export const ProjectEvaluatorBenchRegistryContext =
  createContext<ProjectEvaluatorBenchRegistry | null>(null);

type BenchScope = {
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
};

/**
 * Registers the bench operations for as long as the scope panel is open.
 * The panel outlives the bench, which remounts whenever the scope changes
 * what it lists, so a call made while the records load waits for them
 * instead of failing as "not mounted".
 */
export function useProjectEvaluatorBenchRegistration(
  scope: BenchScope
): ProjectEvaluatorBenchRegistry {
  const agentStore = useContext(AgentContext);
  const [registry] = useState(createBenchRegistry);
  const scopeRef = useRef(scope);
  // eslint-disable-next-line react/refs
  scopeRef.current = scope;
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    const access = {
      getHost: registry.get,
      getScope: () => scopeRef.current,
    };
    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readProjectEvaluatorBenchOperation,
          handler: createReadProjectEvaluatorBenchClientAction(access),
        },
        {
          descriptor: runProjectEvaluatorBenchOperation,
          handler: createRunProjectEvaluatorBenchClientAction(access),
        },
      ],
    });
  }, [agentStore, registry]);
  return registry;
}

/**
 * Publishes the mounted bench to the panel's registry. A layout effect, so
 * a bench hidden behind its loading fallback stops answering at once.
 */
export function usePublishProjectEvaluatorBench(
  host: ProjectEvaluatorBenchHost
) {
  const registry = useContext(ProjectEvaluatorBenchRegistryContext);
  const hostRef = useRef(host);
  // eslint-disable-next-line react/refs
  hostRef.current = host;
  const { targetType, filterCondition } = host;
  useLayoutEffect(() => {
    if (!registry) {
      return undefined;
    }
    const published: ProjectEvaluatorBenchHost = {
      targetType,
      filterCondition,
      getEntries: () => hostRef.current.getEntries(),
      getSnapshot: () => hostRef.current.getSnapshot(),
      runEntries: (entries) => hostRef.current.runEntries(entries),
    };
    return registry.publish(published);
  }, [registry, targetType, filterCondition]);
}
