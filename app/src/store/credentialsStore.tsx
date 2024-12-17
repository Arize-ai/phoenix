import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type CredentialsProps = Partial<Record<ModelProvider, string>>;

export interface CredentialsState extends CredentialsProps {
  /**
   * Setter for a given credential
   * @param credential the name of the credential to set
   * @param value the value of the credential
   */
  setCredential: (params: { provider: ModelProvider; value: string }) => void;
}

export const createCredentialsStore = (
  initialProps: Partial<CredentialsProps>
) => {
  const credentialsStore: StateCreator<CredentialsState> = (set) => ({
    setCredential: ({ provider, value }) => {
      set({ [provider]: value });
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
