import {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type SpanFilterConditionContextType = {
  filterCondition: string;
  setFilterCondition: (condition: string) => void;
  appendFilterCondition: (condition: string) => void;
};

export const SpanFilterConditionContext =
  createContext<SpanFilterConditionContextType | null>(null);

export function useSpanFilterCondition() {
  const context = useContext(SpanFilterConditionContext);
  if (context === null) {
    throw new Error(
      "useSpanFilterCondition must be used within a SpanFilterConditionProvider"
    );
  }
  return context;
}

export function SpanFilterConditionProvider(props: PropsWithChildren) {
  const [filterCondition, _setFilterCondition] = useState<string>("");
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

  return (
    <SpanFilterConditionContext.Provider
      value={{ filterCondition, setFilterCondition, appendFilterCondition }}
    >
      {props.children}
    </SpanFilterConditionContext.Provider>
  );
}
