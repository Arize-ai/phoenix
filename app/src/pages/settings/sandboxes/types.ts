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

export type EnvVarFormEntry = {
  name: string;
  secretKey: string;
};

export type SandboxConfigFormValues = {
  sandboxProviderId: string;
  /**
   * The execution language for this config. Required on create; row-immutable
   * post-create. The form still embeds it inside the variant payload on
   * update (the schema requires it on every `Sandbox*ConfigInput`), but the
   * server rejects a mismatched value at the language-immutability guard in
   * ``update_sandbox_config`` — see `sandbox_config_mutations.py:533-540`.
   * The UI disables editing on edit mode.
   */
  language: "PYTHON" | "TYPESCRIPT" | "";
  name: string;
  description: string;
  timeout: number;
  envVars: EnvVarFormEntry[];
  internetAccessEnabled: boolean;
  dependenciesText: string;
};

// Must stay aligned with the backend column server_default in
// src/phoenix/db/models.py and the mutation fallback in
// src/phoenix/server/api/mutations/sandbox_config_mutations.py.
export const DEFAULT_SANDBOX_TIMEOUT_SECONDS = 300;
