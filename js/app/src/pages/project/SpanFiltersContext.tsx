import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import type { SetSpansFilterInput } from "@phoenix/agent/tools/spansFilter";
import {
  registerUiOperation,
  unregisterUiOperation,
} from "@phoenix/agent/uiOperations/catalog";
import { setSpansFilterOperation } from "@phoenix/agent/uiOperations/operations/spansFilter";
import { SPAN_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import { joinFilterConditions } from "@phoenix/utils/filterConditionUtils";

import { validateSpanFilterCondition } from "./spanFilterValidation";

/**
 * Write-side operations on the span filter. Split from the filter-condition
 * value so that consumers which only need to append or replace the condition
 * (row cells, tooltips) don't re-render on every keystroke in the filter
 * input — which is what would happen if these callbacks lived on the same
 * context as the condition string.
 */
export type SpanFiltersActions = {
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

/**
 * Full context surface used by the filter field itself, which needs both the
 * current condition string and the actions to update it. Kept as a type so
 * `useSpanFilters` can hand back the composed view.
 */
export type SpanFiltersContextType = SpanFiltersActions & {
  filterCondition: string;
};

/**
 * The condition string is on its own context so that consumers subscribing
 * only to the actions don't re-render when the condition changes. The filter
 * field is the only consumer of this context in the common path.
 */
const SpanFilterConditionContext = createContext<string | null>(null);

/**
 * Actions are stable for the provider's lifetime — they read the current
 * condition through a ref rather than closing over it — so a component that
 * only calls `appendFilterCondition` never re-renders because of typing.
 */
const SpanFiltersActionsContext = createContext<SpanFiltersActions | null>(
  null
);

/**
 * The condition + actions together, for callers that need both (e.g. the
 * filter field). Prefer `useSpanFilterCondition` or `useSpanFilterActions`
 * where only one half is needed — that's what avoids per-row re-renders on
 * every keystroke.
 */
export function useSpanFilters(): SpanFiltersContextType {
  const filterCondition = useSpanFilterCondition();
  const actions = useSpanFilterActions();
  return { filterCondition, ...actions };
}

/**
 * The current filter condition string. Subscribing to just this re-renders on
 * every keystroke, so use it only where the string itself is rendered.
 */
export function useSpanFilterCondition(): string {
  const value = useContext(SpanFilterConditionContext);
  if (value === null) {
    throw new Error(
      "useSpanFilterCondition must be used within a SpanFiltersProvider"
    );
  }
  return value;
}

/**
 * The write-side operations for the span filter. Identity is stable for the
 * provider's lifetime, so this hook never causes a consumer to re-render on
 * its own — the reference to render-per-keystroke consumers should get from
 * the context.
 */
export function useSpanFilterActions(): SpanFiltersActions {
  const value = useContext(SpanFiltersActionsContext);
  if (value === null) {
    throw new Error(
      "useSpanFilterActions must be used within a SpanFiltersProvider"
    );
  }
  return value;
}

/**
 * Captures the mount-time condition from the URL, falling back to the caller's
 * supplied value. Whitespace-only text is normalized to the empty condition so
 * the editor and query seed agree.
 *
 * This hook is intentionally mount-only for call sites that own query preload
 * state. `SpanFiltersProvider` separately follows later URL changes so browser
 * navigation still updates its controlled editor.
 */
export function useInitialSpanFilterCondition(fallbackFilterCondition = "") {
  const [searchParams] = useSearchParams();
  const [initialCondition] = useState<string>(() => {
    const condition =
      searchParams.get(SPAN_FILTER_CONDITION_PARAM) ?? fallbackFilterCondition;
    return condition.trim() === "" ? "" : condition;
  });
  return initialCondition;
}

export function SpanFiltersProvider(
  props: PropsWithChildren<{
    /**
     * The condition used whenever the URL carries none. Query-owning callers
     * pass the same resolved seed used for their preload so the editor and
     * loaded GraphQL fields start in agreement.
     */
    fallbackFilterCondition?: string;
  }>
) {
  // Writes back to the URL happen where the state is applied (SpansTable), so
  // only valid conditions are persisted.
  const [searchParams] = useSearchParams();
  const initialUrlCondition = useInitialSpanFilterCondition(
    props.fallbackFilterCondition
  );
  const [filterCondition, _setFilterCondition] =
    useState<string>(initialUrlCondition);
  const rawUrlCondition =
    searchParams.get(SPAN_FILTER_CONDITION_PARAM) ??
    props.fallbackFilterCondition ??
    "";
  const urlCondition = rawUrlCondition.trim() === "" ? "" : rawUrlCondition;

  // Follow navigation that explicitly changes the filter while leaving
  // unrelated search-param updates alone. An applied filter's own URL write is
  // a no-op here because the draft already contains that same condition.
  useEffect(() => {
    startTransition(() => {
      _setFilterCondition(urlCondition);
    });
  }, [urlCondition]);

  // `appendFilterCondition` needs the current condition to join against, but
  // closing over it would give the callback a new identity on every keystroke
  // — which would either force all action-only consumers (row cells,
  // tooltips) to re-render, or defeat any memoization built on top of it.
  // Reading the latest condition through a ref keeps the callback stable
  // while still joining against fresh state.
  const filterConditionRef = useRef(filterCondition);
  useEffect(() => {
    filterConditionRef.current = filterCondition;
  }, [filterCondition]);

  const actions = useMemo<SpanFiltersActions>(
    () => ({
      setFilterCondition: (condition: string) => {
        startTransition(() => {
          _setFilterCondition(condition);
        });
      },
      appendFilterCondition: (condition: string) => {
        startTransition(() => {
          _setFilterCondition(
            joinFilterConditions({
              existingCondition: filterConditionRef.current,
              nextCondition: condition,
            })
          );
        });
      },
    }),
    []
  );

  useRegisterSetSpansFilterClientAction({
    setFilterCondition: actions.setFilterCondition,
  });

  return (
    <SpanFiltersActionsContext.Provider value={actions}>
      <SpanFilterConditionContext.Provider value={filterCondition}>
        {props.children}
      </SpanFilterConditionContext.Provider>
    </SpanFiltersActionsContext.Provider>
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
    registerUiOperation({
      agentStore,
      descriptor: setSpansFilterOperation,
      handler: handleSetSpansFilter,
    });
    return () => {
      unregisterUiOperation({ agentStore, name: setSpansFilterOperation.name });
    };
  }, [agentStore]);
}
