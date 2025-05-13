import {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type SessionSearchContextType = {
  filterIoSubstring: string;
  setFilterIoSubstring: (condition: string) => void;
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

export function SessionSearchProvider(props: PropsWithChildren) {
  const [substring, _setSubstring] = useState<string>("");
  const setSubstring = useCallback((condition: string) => {
    startTransition(() => {
      _setSubstring(condition);
    });
  }, []);
  return (
    <SessionSearchContext.Provider
      value={{
        filterIoSubstring: substring,
        setFilterIoSubstring: setSubstring,
      }}
    >
      {props.children}
    </SessionSearchContext.Provider>
  );
}
