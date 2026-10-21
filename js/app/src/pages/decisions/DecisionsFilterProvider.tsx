import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useContext } from "react";
import { useSearchParams } from "react-router";

import { useLabelFilterSearchParams } from "@phoenix/hooks";

type DecisionsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedDecisionLabelIds: string[];
  setSelectedDecisionLabelIds: Dispatch<SetStateAction<string[]>>;
};
const context = createContext<DecisionsFilterContext | null>(null);
export function DecisionsFilterProvider({ children }: PropsWithChildren) {
  const [params, setParams] = useSearchParams();
  const filter = params.get("search") ?? "";
  const [selectedDecisionLabelIds, setSelectedDecisionLabelIds] =
    useLabelFilterSearchParams();
  const setFilter: Dispatch<SetStateAction<string>> = (value) =>
    setParams(
      (previous) => {
        const next =
          typeof value === "function"
            ? value(previous.get("search") ?? "")
            : value;
        if (next) previous.set("search", next);
        else previous.delete("search");
        return previous;
      },
      { replace: true }
    );
  return (
    <context.Provider
      value={{
        filter,
        setFilter,
        selectedDecisionLabelIds,
        setSelectedDecisionLabelIds,
      }}
    >
      {children}
    </context.Provider>
  );
}
export function useDecisionsFilterContext() {
  const value = useContext(context);
  if (!value) throw new Error("Missing DecisionsFilterProvider");
  return value;
}
