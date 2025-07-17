import { createContext, PropsWithChildren, useContext } from "react";

/**
 * Global static context for the functionality of the platform
 */
export type FunctionalityContextType = {
  /**
   * Will be set to true if the platform is deployed with authentication
   */
  authenticationEnabled: boolean;
};

export const FunctionalityContext =
  createContext<FunctionalityContextType | null>(null);

export function useFunctionality() {
  const context = useContext(FunctionalityContext);
  if (context === null) {
    throw new Error(
      "useFunctionality must be used within a FunctionalityProvider"
    );
  }
  return context;
}

export function FunctionalityProvider(props: PropsWithChildren) {
  return (
    <FunctionalityContext.Provider
      value={{
        authenticationEnabled: window.Config.authenticationEnabled,
      }}
    >
      {props.children}
    </FunctionalityContext.Provider>
  );
}
