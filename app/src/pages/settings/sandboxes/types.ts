import type {
  SettingsSandboxesPageFragment$data,
  SettingsSandboxesPageFragment$key,
} from "./__generated__/SettingsSandboxesPageFragment.graphql";

export type { SettingsSandboxesPageFragment$key };

export type BackendInfo =
  SettingsSandboxesPageFragment$data["sandboxBackends"][number];
export type SandboxProvider =
  SettingsSandboxesPageFragment$data["sandboxProviders"][number];
export type SandboxConfig = SandboxProvider["configs"][number];

export type ProviderRow = {
  backend: BackendInfo;
  provider: SandboxProvider;
};

export type ConfigRow = {
  backend: BackendInfo;
  provider: SandboxProvider;
  config: SandboxConfig;
};

export type EnvVarFormEntry =
  | { kind: "literal"; name: string; value: string }
  | { kind: "secret_ref"; name: string; secret_key: string };

export type SandboxConfigFormValues = {
  sandboxProviderId: string;
  name: string;
  description: string;
  timeout: number;
  envVars: EnvVarFormEntry[];
  internetAccessEnabled: boolean;
  dependenciesText: string;
  dependenciesLockfile: string | null;
};

// Must stay aligned with the backend column server_default in
// src/phoenix/db/models.py and the mutation fallback in
// src/phoenix/server/api/mutations/sandbox_config_mutations.py.
export const DEFAULT_SANDBOX_TIMEOUT_SECONDS = 300;
