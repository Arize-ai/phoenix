import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

/**
 * A type representing the v0 credentials props. This is the legacy format of credentials where each provider had a single credential.
 * @deprecated
 */
type V0CredentialsProps = Record<ModelProvider, string>;

/**
 * Check if the given props are a valid v0 credentials object
 * @param props the props to check
 * @returns true if the props are a valid v0 credentials object, false otherwise
 */
function isV0CredentialsProps(props: unknown): props is V0CredentialsProps {
  return (
    typeof props === "object" &&
    props !== null &&
    Object.keys(props).length > 0 &&
    Object.keys(props).every((key) => key in ProviderToCredentialsConfigMap) &&
    Object.values(props).every((value) => typeof value === "string")
  );
}

function migrateV0CredentialsProps(
  props: V0CredentialsProps
): CredentialsProps {
  const newProps: CredentialsProps = {};
  for (const provider of Object.keys(props)) {
    if (!isModelProvider(provider)) {
      continue;
    }
    // Only migrate credentials if the provider has 1 credential
    if (ProviderToCredentialsConfigMap[provider].length === 1) {
      newProps[provider] = {
        [ProviderToCredentialsConfigMap[provider][0].envVarName]:
          props[provider],
      };
    }
  }
  return newProps;
}

type CredentialEnvVarName = string;
type CredentialValue = string | null;
/**
 * A simple string to string map of environment variables to values
 */
type ProviderCredentialsMap = Record<CredentialEnvVarName, CredentialValue>;

export type CredentialsProps = Partial<
  Record<ModelProvider, ProviderCredentialsMap>
>;

export interface CredentialsState extends CredentialsProps {
  /**
   * Setter for a given credential
   * @param credential the name of the credential to set
   * @param value the value of the credential
   */
  setCredential: (params: {
    provider: ModelProvider;
    envVarName: string;
    value: string | null;
  }) => void;
}

export const createCredentialsStore = (
  initialProps: Partial<CredentialsProps>
) => {
  const credentialsStore: StateCreator<
    CredentialsState,
    [["zustand/devtools", unknown]]
  > = (set) => ({
    setCredential: ({ provider, envVarName, value }) => {
      set(
        (state) => ({
          [provider]: {
            ...state[provider],
            [envVarName]: value,
          },
        }),
        false,
        { type: "setCredential" }
      );
    },
    ...initialProps,
  });
  return create<CredentialsState>()(
    persist(devtools(credentialsStore), {
      version: 1,
      name: "arize-phoenix-credentials",
      // Migrate from legacy credentials to new credentials
      migrate: (state: unknown) => {
        // Only provide a migration if the state is a valid legacy credentials object
        if (isV0CredentialsProps(state)) {
          return migrateV0CredentialsProps(state);
        }
      },
    })
  );
};

export type CredentialsStore = ReturnType<typeof createCredentialsStore>;
