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

export type ProviderSettingsFormValues = {
  configText: string;
};

export type SandboxConfigFormValues = {
  sandboxProviderId: string;
  name: string;
  description: string;
  timeout: number;
  configText: string;
};
