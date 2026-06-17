import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";

/**
 * Global static context for the functionality of the platform
 */
export type FunctionalityContextType = {
  /**
   * Will be set to true if the platform is deployed with authentication
   */
  authenticationEnabled: boolean;
  /**
   * Will be set to true if per-resource access control is enforcing. When false,
   * grants are not enforced — every authenticated user can see everything.
   */
  accessControlEnabled: boolean;
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
        accessControlEnabled: window.Config.accessControlEnabled,
      }}
    >
      {props.children}
    </FunctionalityContext.Provider>
  );
}
