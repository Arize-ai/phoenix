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
 * Combined state for the on-screen span filters: the freeform filter
 * condition expression and the root-vs-all-spans toggle. These two pieces of
 * state are surfaced together in the spans page UI and are jointly advertised
 * to the PXI agent so it can drive both via tool calls.
 */
export type SpanFiltersContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
  rootSpansOnly: boolean;
  setRootSpansOnly: (rootSpansOnly: boolean) => void;
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

export function SpanFiltersProvider(props: PropsWithChildren) {
  const [searchParams] = useSearchParams();
  // Seed the filter from the URL so server-generated deep links (e.g. cohort
  // permalinks carrying `?filter=...`) open the table pre-filtered. The
  // search param arrives URL-decoded from useSearchParams, so the condition
  // lands in the field verbatim.
  const [filterCondition, _setFilterCondition] = useState<string>(
    () => searchParams.get(SPAN_FILTER_CONDITION_PARAM) ?? ""
  );
  const [rootSpansOnly, _setRootSpansOnly] = useState<boolean>(true);

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
  const setRootSpansOnly = useCallback((rootSpansOnly: boolean) => {
    startTransition(() => {
      _setRootSpansOnly(rootSpansOnly);
    });
  }, []);

  useRegisterSetSpansFilterClientAction({
    setFilterCondition,
    setRootSpansOnly,
  });

  return (
    <SpanFiltersContext.Provider
      value={{
        filterCondition,
        setFilterCondition,
        appendFilterCondition,
        rootSpansOnly,
        setRootSpansOnly,
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
  setRootSpansOnly,
}: {
  setFilterCondition: (condition: string) => void;
  setRootSpansOnly: (rootSpansOnly: boolean) => void;
}) {
  const agentStore = useAgentStore();
  const projectId = useTracingContext((state) => state.projectId);

  const handleSetSpansFilter = useEffectEvent(
    async (input: SetSpansFilterInput): Promise<AgentClientActionResult> => {
      // Shape is already validated by parseSetSpansFilterInput in the tool
      // registry before dispatch; here we only handle business logic.
      const { condition, rootSpansOnly } = input;

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
      setRootSpansOnly(rootSpansOnly);

      const conditionMessage = condition
        ? `Applied filter: ${condition}.`
        : "Cleared the span filter.";
      const rootMessage = rootSpansOnly
        ? "Showing root spans only."
        : "Showing all spans.";
      return {
        ok: true,
        output: `${conditionMessage} ${rootMessage}`,
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
