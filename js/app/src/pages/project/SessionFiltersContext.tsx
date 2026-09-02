import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import { SESSION_FILTER_CONDITION_PARAM } from "@phoenix/constants/searchParams";
import { joinFilterConditions } from "@phoenix/utils/filterConditionUtils";

import { readFilterConditionParam } from "./filterConditionParam";

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
  // Reads only: the URL is written where a condition is applied, so
  // unvalidated drafts are never persisted.
  const [searchParams] = useSearchParams();
  const urlCondition = readFilterConditionParam(
    searchParams,
    SESSION_FILTER_CONDITION_PARAM
  );
  const [filterCondition, setFilterConditionState] =
    useState<string>(urlCondition);

  // A just-applied filter's own URL write lands here as a no-op: the draft
  // already holds that condition.
  useEffect(() => {
    startTransition(() => {
      setFilterConditionState(urlCondition);
    });
  }, [urlCondition]);

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
