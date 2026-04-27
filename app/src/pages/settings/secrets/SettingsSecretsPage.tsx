import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import {
  ConnectionHandler,
  graphql,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";
import { Navigate, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  DebouncedSearch,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { SecretOwnerFilterOptions } from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";

import type { SettingsSecretsPageFragment$key } from "./__generated__/SettingsSecretsPageFragment.graphql";
import type { settingsSecretsPageLoaderQuery } from "./__generated__/settingsSecretsPageLoaderQuery.graphql";
import type { SettingsSecretsPageRefetchQuery } from "./__generated__/SettingsSecretsPageRefetchQuery.graphql";
import { SecretsTable } from "./SecretsTable";
import type { SettingsSecretsPageLoaderType } from "./settingsSecretsPageLoader";
import { settingsSecretsPageLoaderGql } from "./settingsSecretsPageLoader";
import type { SecretOwnerFilter } from "./types";

export const SECRETS_CONNECTION_KEY = "SettingsSecretsPage_secrets";

export function SettingsSecretsPage() {
  const { viewer } = useViewer();
  const canManageSecrets = !viewer || viewer.role.name === "ADMIN";
  const loaderData = useLoaderData<SettingsSecretsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsSecretsPageLoaderQuery>(
    settingsSecretsPageLoaderGql,
    loaderData
  );

  if (!canManageSecrets) {
    return <Navigate to="/settings/general" replace />;
  }

  return <SettingsSecretsPageContent secrets={data} />;
}

function SettingsSecretsPageContent({
  secrets,
}: {
  secrets: SettingsSecretsPageFragment$key;
}) {
  const { authenticationEnabled } = useFunctionality();
  const { viewer } = useViewer();
  const [data, refetch] = useRefetchableFragment<
    SettingsSecretsPageRefetchQuery,
    SettingsSecretsPageFragment$key
  >(
    graphql`
      fragment SettingsSecretsPageFragment on Query
      @refetchable(queryName: "SettingsSecretsPageRefetchQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 100 }
        cursor: { type: "String" }
      ) {
        secrets(first: $count, after: $cursor)
          @connection(key: "SettingsSecretsPage_secrets") {
          edges {
            node {
              id
              key
              updatedAt
              user {
                id
                username
                profilePictureUrl
              }
            }
          }
        }
      }
    `,
    secrets
  );

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<SecretOwnerFilter>("ALL");

  const connectionId = useMemo(
    () =>
      ConnectionHandler.getConnectionID("client:root", SECRETS_CONNECTION_KEY),
    []
  );

  const refreshOnMount = useEffectEvent(() => {
    refetch({}, { fetchPolicy: "store-and-network" });
  });

  useEffect(() => {
    // Secrets can be mutated outside this page (other surfaces don't yet
    // update the connection), so refetch once on mount to get fresh data.
    refreshOnMount();
  }, []);

  const tableData = useMemo(
    () => data.secrets.edges.map(({ node }) => node),
    [data.secrets.edges]
  );

  const filteredTableData = useMemo(() => {
    if (ownerFilter !== "MINE") {
      return tableData;
    }
    return tableData.filter((row) => row.user?.id === viewer?.id);
  }, [ownerFilter, tableData, viewer?.id]);

  return (
    <Flex direction="column" gap="size-200">
      <Flex gap="size-200" alignItems="center" justifyContent="space-between">
        <DebouncedSearch
          aria-label="Search secrets"
          placeholder="Search secrets"
          onChange={setSearch}
          defaultValue={search}
        />
        {authenticationEnabled ? (
          <Select
            aria-label="Secret owner filter"
            value={ownerFilter}
            onChange={(value) => {
              startTransition(() => {
                setOwnerFilter(value as SecretOwnerFilter);
              });
            }}
            selectionMode="single"
          >
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox items={SecretOwnerFilterOptions}>
                {(item) => (
                  <SelectItem id={item.id} textValue={item.id}>
                    {item.label}
                  </SelectItem>
                )}
              </ListBox>
            </Popover>
          </Select>
        ) : null}
      </Flex>
      <SecretsTable
        data={filteredTableData}
        authenticationEnabled={authenticationEnabled}
        search={search}
        connectionId={connectionId}
      />
    </Flex>
  );
}
