import { startTransition, useCallback, useMemo } from "react";
import {
  graphql,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { CanManageSandboxes } from "@phoenix/components/auth";
import type { settingsSandboxesPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsSandboxesPageLoaderQuery.graphql";
import type { SettingsSandboxesPageLoaderType } from "@phoenix/pages/settings/settingsSandboxesPageLoader";
import { settingsSandboxesPageLoaderGql } from "@phoenix/pages/settings/settingsSandboxesPageLoader";

import type { SettingsSandboxesPageRefetchQuery } from "./__generated__/SettingsSandboxesPageRefetchQuery.graphql";
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
  const [data, refetch] = useRefetchableFragment<
    SettingsSandboxesPageRefetchQuery,
    SettingsSandboxesPageFragment$key
  >(
    graphql`
      fragment SettingsSandboxesPageFragment on Query
      @refetchable(queryName: "SettingsSandboxesPageRefetchQuery") {
        sandboxBackends {
          backendType
          displayName
          hostingType
          dependencyHints
          supportedLanguages
          status
          statusDetail
          supportsEnvVars
          internetAccess
          dependenciesLanguage
          credentialSpecs {
            key
            displayName
            description
            isRequired
          }
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
        // Local providers first, then alphabetical by display name, then by
        // language for stable ordering when two providers share a name.
        const aLocal = a.backend.hostingType === "LOCAL" ? 0 : 1;
        const bLocal = b.backend.hostingType === "LOCAL" ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        const nameCmp = a.backend.displayName.localeCompare(
          b.backend.displayName
        );
        if (nameCmp !== 0) return nameCmp;
        return a.provider.language.localeCompare(b.provider.language);
      }) satisfies ProviderRow[];
  }, [data.sandboxBackends, data.sandboxProviders]);

  const configRows = useMemo(
    () =>
      providerRows.flatMap(({ backend, provider }) =>
        provider.configs.map((config) => ({ backend, provider, config }))
      ) as ConfigRow[],
    [providerRows]
  );

  const refresh = useCallback(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "network-only" });
    });
  }, [refetch]);

  return (
    <Flex direction="column" gap="size-200">
      <SandboxProvidersCard providers={providerRows} onRefresh={refresh} />
      <SandboxConfigsCard configRows={configRows} providerRows={providerRows} />
    </Flex>
  );
}
