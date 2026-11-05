import { createContext, useContext } from "react";

interface CredentialContextValue {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  /**
   * Whether the field holds something the clear button can remove: typed
   * text, or a saved value the input does not show.
   */
  canClear: boolean;
  clear: () => void;
  /**
   * A disabled or read-only field offers neither button: there is nothing to
   * reveal or remove.
   */
  isInteractive: boolean;
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
