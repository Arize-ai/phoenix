import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type SessionSearchContextType = {
  filterSubstring: string;
  setFilterSubstring: (condition: string) => void;
};

export const SessionSearchContext =
  createContext<SessionSearchContextType | null>(null);

export function useSessionSearchContext() {
  const context = useContext(SessionSearchContext);
  if (context === null) {
    throw new Error(
      "useSessionSubstring must be used within a SessionSubstringProvider"
    );
  }
  return context;
}

export function SessionSubstringProvider(props: PropsWithChildren) {
  const [substring, _setSubstring] = useState<string>("");
  const setSubstring = useCallback((condition: string) => {
    startTransition(() => {
      _setSubstring(condition);
    });
  }, []);
  return (
    <SessionSearchContext.Provider
      value={{ filterSubstring: substring, setFilterSubstring: setSubstring }}
    >
      {props.children}
    </SessionSearchContext.Provider>
  );
}
