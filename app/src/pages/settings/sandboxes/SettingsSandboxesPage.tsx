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
          kind
          displayName
          hostingType
          dependencyHints
          supportedLanguages
          status
          statusDetail
          supportsEnvVars
          internetAccess
          supportsDependencies
          credentialSpecs {
            key
            displayName
            description
            isRequired
          }
        }
        sandboxProviders {
          id
          kind
          supportedLanguages
          enabled
          configs {
            id
            name
            description
            language
            timeout
            enabled
            config {
              envVars {
                name
                value {
                  __typename
                  ... on SandboxConfigEnvVarLiteral {
                    literal
                  }
                  ... on SandboxConfigEnvVarSecretRef {
                    secretKey
                  }
                }
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
            updatedAt
          }
        }
      }
    `,
    query
  );

  const providerRows = useMemo(() => {
    const backendByKind = new Map(
      data.sandboxBackends.map((backend: BackendInfo) => [
        backend.kind,
        backend,
      ])
    );
    return data.sandboxProviders
      .map((provider: SandboxProvider) => ({
        provider,
        backend: backendByKind.get(provider.kind),
      }))
      .filter(
        (row): row is { provider: SandboxProvider; backend: BackendInfo } =>
          row.backend != null
      )
      .sort((a, b) => {
        // Local providers first, then alphabetical by display name.
        const aLocal = a.backend.hostingType === "LOCAL" ? 0 : 1;
        const bLocal = b.backend.hostingType === "LOCAL" ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return a.backend.displayName.localeCompare(b.backend.displayName);
      }) satisfies ProviderRow[];
  }, [data.sandboxBackends, data.sandboxProviders]);

  const configRows = useMemo(
    () =>
      providerRows.flatMap(({ backend, provider }) =>
        [...provider.configs]
          .sort((leftConfig, rightConfig) => {
            const nameComparison = leftConfig.name.localeCompare(
              rightConfig.name
            );
            if (nameComparison !== 0) {
              return nameComparison;
            }
            return leftConfig.id.localeCompare(rightConfig.id);
          })
          .map((config) => ({ backend, provider, config }))
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
