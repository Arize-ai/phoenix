import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

import { joinFilterConditions } from "@phoenix/utils/filterConditionUtils";

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
