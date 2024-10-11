import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface CredentialsProps {
  /**
   * The API key for the OpenAI API.
   */
  OPENAI_API_KEY?: string;
  /**
   * The API key for the Azure OpenAI API.
   */
  AZURE_OPENAI_API_KEY?: string;
  /**
   * The API key for the Anthropic API.
   */
  ANTHROPIC_API_KEY?: string;
}

export type CredentialKey = keyof CredentialsProps;

export interface CredentialsState extends CredentialsProps {
  /**
   * Setter for a given credential
   * @param credential the name of the credential to set
   * @param value the value of the credential
   */
  setCredential: (params: {
    credential: keyof CredentialsProps;
    value: string;
  }) => void;
}

export const createCredentialsStore = (
  initialProps: Partial<CredentialsProps>
) => {
  const credentialsStore: StateCreator<CredentialsState> = (set) => ({
    setCredential: ({ credential, value }) => {
      set({ [credential]: value });
    },
    ...initialProps,
  });
  return create<CredentialsState>()(
    persist(devtools(credentialsStore), {
      name: "arize-phoenix-credentials",
    })
  );
};

export type CredentialsStore = ReturnType<typeof createCredentialsStore>;
