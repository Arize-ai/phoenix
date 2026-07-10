import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

import { joinFilterConditions } from "@phoenix/components/filter";

export type ExperimentRunFilterConditionContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

export const ExperimentRunFilterConditionContext =
  createContext<ExperimentRunFilterConditionContextType | null>(null);

export function useExperimentRunFilterCondition() {
  const context = useContext(ExperimentRunFilterConditionContext);
  if (context === null) {
    throw new Error(
      "useExperimentRunFilterCondition must be used within a ExperimentRunFilterConditionProvider"
    );
  }
  return context;
}

export function ExperimentRunFilterConditionProvider(props: PropsWithChildren) {
  const [filterCondition, _setFilterCondition] = useState<string>("");
  const setFilterCondition = useCallback((condition: string) => {
    startTransition(() => {
      _setFilterCondition(condition);
    });
  }, []);
  const appendFilterCondition = useCallback((condition: string) => {
    startTransition(() => {
      _setFilterCondition((currentCondition) =>
        joinFilterConditions({
          existingCondition: currentCondition,
          nextCondition: condition,
        })
      );
    });
  }, []);

  return (
    <ExperimentRunFilterConditionContext.Provider
      value={{ filterCondition, setFilterCondition, appendFilterCondition }}
    >
      {props.children}
    </ExperimentRunFilterConditionContext.Provider>
  );
}
