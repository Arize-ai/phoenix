import { createContext, ReactNode, useContext } from "react";

import { InferencesRole } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

type InferencesDef = {
  name: string;
  startTime: string;
  endTime: string;
};

export type InferencesContextType = {
  primaryInferences: InferencesDef;
  referenceInferences: InferencesDef | null;
  corpusInferences: InferencesDef | null;
  getInferencesNameByRole: (role: InferencesRole) => string;
};

export const InferencesContext = createContext<InferencesContextType | null>(
  null
);

export function useInferences() {
  const context = useContext(InferencesContext);
  if (context === null) {
    throw new Error("useInferences must be used within a InferencesProvider");
  }
  return context;
}

type InferencesProviderProps = {
  primaryInferences: InferencesDef;
  referenceInferences: InferencesDef | null;
  corpusInferences: InferencesDef | null;
  children: ReactNode;
};

export function InferencesProvider(props: InferencesProviderProps) {
  return (
    <InferencesContext.Provider
      value={{
        primaryInferences: props.primaryInferences,
        referenceInferences: props.referenceInferences,
        corpusInferences: props.corpusInferences,
        getInferencesNameByRole: (inferencesRole: InferencesRole) => {
          switch (inferencesRole) {
            case InferencesRole.primary:
              return props.primaryInferences.name;
            case InferencesRole.reference:
              return props.referenceInferences?.name ?? "reference";
            case InferencesRole.corpus:
              return props.corpusInferences?.name ?? "corpus";
            default:
              assertUnreachable(inferencesRole);
          }
        },
      }}
    >
      {props.children}
    </InferencesContext.Provider>
  );
}
