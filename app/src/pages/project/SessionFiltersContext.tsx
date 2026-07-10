import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  SET_SESSIONS_FILTER_TOOL_NAME,
  type SetSessionsFilterInput,
} from "@phoenix/agent/tools/sessionsFilter";
import { joinFilterConditions } from "@phoenix/components/filter";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { validateSessionFilterCondition } from "./sessionFilterValidation";

export type SessionFiltersContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

export const SessionFiltersContext =
  createContext<SessionFiltersContextType | null>(null);

export function useSessionFilters() {
  const context = useContext(SessionFiltersContext);
  if (context === null) {
    throw new Error(
      "useSessionFilters must be used within a SessionFiltersProvider"
    );
  }
  return context;
}

export function SessionFiltersProvider(props: PropsWithChildren) {
  const [filterCondition, setFilterConditionState] = useState<string>("");

  function setFilterCondition(condition: string) {
    startTransition(() => {
      setFilterConditionState(condition);
    });
  }

  function appendFilterCondition(condition: string) {
    startTransition(() => {
      setFilterConditionState((currentCondition) =>
        joinFilterConditions({
          existingCondition: currentCondition,
          nextCondition: condition,
        })
      );
    });
  }

  useRegisterSetSessionsFilterClientAction({ setFilterCondition });

  return (
    <SessionFiltersContext.Provider
      value={{
        filterCondition,
        setFilterCondition,
        appendFilterCondition,
      }}
    >
      {props.children}
    </SessionFiltersContext.Provider>
  );
}

function useRegisterSetSessionsFilterClientAction({
  setFilterCondition,
}: {
  setFilterCondition: (condition: string) => void;
}) {
  const agentStore = useAgentStore();
  const projectId = useTracingContext((state) => state.projectId);

  const handleSetSessionsFilter = useEffectEvent(
    async (input: SetSessionsFilterInput): Promise<AgentClientActionResult> => {
      const { condition } = input;

      if (!projectId) {
        return {
          ok: false,
          error:
            "Sessions filter field is not bound to a project on this page.",
        };
      }

      if (!condition.trim()) {
        setFilterCondition("");
        return {
          ok: true,
          output: "Cleared the sessions filter.",
        };
      }

      const validation = await validateSessionFilterCondition(
        condition,
        projectId
      );
      if (!validation?.isValid) {
        return {
          ok: false,
          error:
            validation?.errorMessage ??
            "Session filter condition failed validation; not applied.",
        };
      }

      setFilterCondition(condition);
      const warningMessage = validation.warnings.length
        ? ` Validation warnings: ${validation.warnings.join(" ")}`
        : "";
      return {
        ok: true,
        output: `Applied sessions filter: ${condition}.${warningMessage}`,
      };
    }
  );

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(SET_SESSIONS_FILTER_TOOL_NAME, (input) =>
      handleSetSessionsFilter(input as SetSessionsFilterInput)
    );
    return () => {
      unregisterClientAction(SET_SESSIONS_FILTER_TOOL_NAME);
    };
  }, [agentStore]);
}
