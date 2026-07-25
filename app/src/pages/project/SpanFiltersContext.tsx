import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import {
  SET_SPANS_FILTER_TOOL_NAME,
  type SetSpansFilterInput,
} from "@phoenix/agent/tools/spansFilter";
import { SPAN_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { validateSpanFilterCondition } from "./spanFilterValidation";

/**
 * State for the on-screen span filter: the freeform filter condition
 * expression, which is the single description of what the spans page is
 * showing. Root-vs-all-spans is part of that expression (`parent_span is
 * None`) rather than a separate flag, so the agent can drive the whole view by
 * manipulating one string.
 */
export type SpanFiltersContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

export const SpanFiltersContext = createContext<SpanFiltersContextType | null>(
  null
);

export function useSpanFilters() {
  const context = useContext(SpanFiltersContext);
  if (context === null) {
    throw new Error("useSpanFilters must be used within a SpanFiltersProvider");
  }
  return context;
}

export function SpanFiltersProvider(
  props: PropsWithChildren<{
    /**
     * The condition to start from when the URL carries none. The spans page
     * seeds this with the root-spans predicate; views that are inherently
     * root-scoped already (traces) or unrelated leave it empty.
     */
    defaultFilterCondition?: string;
  }>
) {
  // Initialize from the URL so a shared/reloaded link restores the filtered
  // view, falling back to the caller's default. Writes back to the URL happen
  // where the state is applied (SpansTable) so only valid conditions are
  // persisted.
  const { defaultFilterCondition = "" } = props;
  const [searchParams] = useSearchParams();
  const [filterCondition, _setFilterCondition] = useState<string>(
    () =>
      searchParams.get(SPAN_FILTER_CONDITION_PARAM) ?? defaultFilterCondition
  );

  const setFilterCondition = useCallback((condition: string) => {
    startTransition(() => {
      _setFilterCondition(condition);
    });
  }, []);
  const appendFilterCondition = useCallback(
    (condition: string) => {
      startTransition(() => {
        if (filterCondition.length > 0) {
          _setFilterCondition(filterCondition + " and " + condition);
        } else {
          _setFilterCondition(condition);
        }
      });
    },
    [filterCondition]
  );
  useRegisterSetSpansFilterClientAction({ setFilterCondition });

  return (
    <SpanFiltersContext.Provider
      value={{
        filterCondition,
        setFilterCondition,
        appendFilterCondition,
      }}
    >
      {props.children}
    </SpanFiltersContext.Provider>
  );
}

/**
 * Registration lives at the provider, not the field, so the action stays
 * registered on tabs (traces, sessions) where the field component is not
 * mounted but the surrounding state container is.
 */
function useRegisterSetSpansFilterClientAction({
  setFilterCondition,
}: {
  setFilterCondition: (condition: string) => void;
}) {
  const agentStore = useAgentStore();
  const projectId = useTracingContext((state) => state.projectId);

  const handleSetSpansFilter = useEffectEvent(
    async (input: SetSpansFilterInput): Promise<AgentClientActionResult> => {
      // Shape is already validated by parseSetSpansFilterInput in the tool
      // registry before dispatch; here we only handle business logic.
      const { condition } = input;

      if (!projectId) {
        return {
          ok: false,
          error: "Span filter field is not bound to a project on this page.",
        };
      }
      const validation = await validateSpanFilterCondition(
        condition,
        projectId
      );
      if (!validation?.isValid) {
        return {
          ok: false,
          error:
            validation?.errorMessage ??
            "Filter condition failed validation; not applied.",
        };
      }
      setFilterCondition(condition);

      return {
        ok: true,
        output: condition
          ? `Applied filter: ${condition}.`
          : "Cleared the span filter; showing all spans.",
      };
    }
  );

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(SET_SPANS_FILTER_TOOL_NAME, (input) =>
      handleSetSpansFilter(input as SetSpansFilterInput)
    );
    return () => {
      unregisterClientAction(SET_SPANS_FILTER_TOOL_NAME);
    };
  }, [agentStore]);
}
