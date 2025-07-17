import { createContext, useContext } from "react";

interface CredentialContextValue {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
}

export const CredentialContext = createContext<CredentialContextValue | null>(
  null
);

export function useCredentialContext() {
  const context = useContext(CredentialContext);
  if (!context) {
    throw new Error(
      "useCredentialContext must be used within a CredentialContext.Provider"
    );
  }
  return context;
}
