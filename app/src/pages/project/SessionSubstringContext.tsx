import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type SessionSubstringContextType = {
  substring: string;
  setSubstring: (condition: string) => void;
};

export const SessionSubstringContext =
  createContext<SessionSubstringContextType | null>(null);

export function useSessionSubstring() {
  const context = useContext(SessionSubstringContext);
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
    <SessionSubstringContext.Provider value={{ substring, setSubstring }}>
      {props.children}
    </SessionSubstringContext.Provider>
  );
}
