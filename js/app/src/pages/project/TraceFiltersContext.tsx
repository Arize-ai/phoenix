import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

import { joinFilterConditions } from "@phoenix/utils/filterConditionUtils";

export type TraceFiltersContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

export const TraceFiltersContext =
  createContext<TraceFiltersContextType | null>(null);

export function useTraceFilters() {
  const context = useContext(TraceFiltersContext);
  if (context === null) {
    throw new Error(
      "useTraceFilters must be used within a TraceFiltersProvider"
    );
  }
  return context;
}

export function TraceFiltersProvider(props: PropsWithChildren) {
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

  return (
    <TraceFiltersContext.Provider
      value={{
        filterCondition,
        setFilterCondition,
        appendFilterCondition,
      }}
    >
      {props.children}
    </TraceFiltersContext.Provider>
  );
}
