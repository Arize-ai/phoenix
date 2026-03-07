import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface SandboxCredentialsState {
  /** Flat map of envVarName -> credential value */
  credentials: Record<string, string>;
  setCredential: (envVarName: string, value: string) => void;
  clearCredential: (envVarName: string) => void;
  getCredential: (envVarName: string) => string | undefined;
}

const sandboxCredentialsStore: StateCreator<
  SandboxCredentialsState,
  [["zustand/devtools", unknown]]
> = (set, get) => ({
  credentials: {},
  setCredential: (envVarName, value) => {
    set(
      (state) => ({
        credentials: {
          ...state.credentials,
          [envVarName]: value,
        },
      }),
      false,
      { type: "setCredential" }
    );
  },
  clearCredential: (envVarName) => {
    set(
      (state) => {
        const { [envVarName]: _, ...rest } = state.credentials;
        return { credentials: rest };
      },
      false,
      { type: "clearCredential" }
    );
  },
  getCredential: (envVarName) => {
    return get().credentials[envVarName];
  },
});

export const useSandboxCredentialsStore = create<SandboxCredentialsState>()(
  persist(devtools(sandboxCredentialsStore), {
    name: "arize-phoenix-sandbox-credentials",
    version: 1,
  })
);
