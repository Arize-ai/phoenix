import type { PropsWithChildren } from "react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type SessionSearchContextType = {
  filterIoSubstringOrSessionId: string;
  setFilterIoSubstringOrSessionId: (condition: string) => void;
  filterUserId: string;
  setFilterUserId: (userId: string) => void;
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
  const [userId, _setUserId] = useState<string>("");
  const setUserId = useCallback((id: string) => {
    startTransition(() => {
      _setUserId(id);
    });
  }, []);
  return (
    <SessionSearchContext.Provider
      value={{
        filterIoSubstringOrSessionId: substring,
        setFilterIoSubstringOrSessionId: setSubstring,
        filterUserId: userId,
        setFilterUserId: setUserId,
      }}
    >
      {props.children}
    </SessionSearchContext.Provider>
  );
}
