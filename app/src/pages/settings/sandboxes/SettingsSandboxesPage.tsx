import { useMemo } from "react";
import { graphql, useFragment, usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { CanManageSandboxes } from "@phoenix/components/auth";
import type { settingsSandboxesPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsSandboxesPageLoaderQuery.graphql";
import type { SettingsSandboxesPageLoaderType } from "@phoenix/pages/settings/settingsSandboxesPageLoader";
import { settingsSandboxesPageLoaderGql } from "@phoenix/pages/settings/settingsSandboxesPageLoader";

import { SandboxConfigsCard } from "./SandboxConfigsCard";
import { SandboxProvidersCard } from "./SandboxProvidersCard";
import type {
  BackendInfo,
  ConfigRow,
  ProviderRow,
  SandboxProvider,
  SettingsSandboxesPageFragment$key,
} from "./types";

export function SettingsSandboxesPage() {
  const loaderData = useLoaderData<SettingsSandboxesPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = usePreloadedQuery<settingsSandboxesPageLoaderQuery>(
    settingsSandboxesPageLoaderGql,
    loaderData
  );
  return (
    <CanManageSandboxes>
      <SettingsSandboxesPageContent query={query} />
    </CanManageSandboxes>
  );
}

function SettingsSandboxesPageContent({
  query,
}: {
  query: SettingsSandboxesPageFragment$key;
}) {
  const data = useFragment(
    graphql`
      fragment SettingsSandboxesPageFragment on Query {
        sandboxBackends {
          backendType
          displayName
          dependencyHints
          supportedLanguages
          status
          supportsEnvVars
          internetAccess
          dependenciesLanguage
        }
        sandboxProviders {
          id
          backendType
          language
          enabled
          config
          updatedAt
          configs {
            id
            name
            description
            timeout
            enabled
            config
            updatedAt
          }
        }
      }
    `,
    query
  );

  const providerRows = useMemo(() => {
    const backendByType = new Map(
      data.sandboxBackends.map((backend: BackendInfo) => [
        backend.backendType,
        backend,
      ])
    );
    return data.sandboxProviders
      .map((provider: SandboxProvider) => ({
        provider,
        backend: backendByType.get(provider.backendType),
      }))
      .filter(
        (row): row is { provider: SandboxProvider; backend: BackendInfo } =>
          row.backend != null
      )
      .sort((a, b) => {
        // any provider with (local) in the name should be first
        if (
          a.backend.displayName.includes("(local)") &&
          !b.backend.displayName.includes("(local)")
        )
          return -1;
        if (
          !a.backend.displayName.includes("(local)") &&
          b.backend.displayName.includes("(local)")
        )
          return 1;
        return 0;
      }) satisfies ProviderRow[];
  }, [data.sandboxBackends, data.sandboxProviders]);

  const configRows = useMemo(
    () =>
      providerRows.flatMap(({ backend, provider }) =>
        provider.configs.map((config) => ({ backend, provider, config }))
      ) as ConfigRow[],
    [providerRows]
  );

  return (
    <Flex direction="column" gap="size-200">
      <SandboxProvidersCard providers={providerRows} />
      <SandboxConfigsCard configRows={configRows} providerRows={providerRows} />
    </Flex>
  );
}
