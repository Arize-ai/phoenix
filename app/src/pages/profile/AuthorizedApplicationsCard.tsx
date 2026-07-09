import { css } from "@emotion/react";
import { startTransition, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { Alert, Badge, Button, Card, Flex, Text } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useNotifySuccess } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AuthorizedApplicationsCardFragment$key } from "./__generated__/AuthorizedApplicationsCardFragment.graphql";
import type { AuthorizedApplicationsCardQuery } from "./__generated__/AuthorizedApplicationsCardQuery.graphql";
import type { AuthorizedApplicationsCardRevokeMutation } from "./__generated__/AuthorizedApplicationsCardRevokeMutation.graphql";

const authorizedApplicationsListCSS = css`
  list-style: none;
  margin: 0;
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const authorizedApplicationCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const authorizedApplicationMetadataCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-100) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const metadataLabelCSS = css`
  display: block;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

function formatTimestamp(
  value: string | null | undefined,
  formatter: (date: Date) => string
) {
  return value ? formatter(new Date(value)) : "Never";
}

function getClientIdSuffix(clientId: string) {
  return clientId.length > 8 ? clientId.slice(-8) : clientId;
}

export function AuthorizedApplicationsCard({
  viewer,
}: {
  viewer: AuthorizedApplicationsCardFragment$key;
}) {
  "use no memo";
  const [data, refetch] = useRefetchableFragment<
    AuthorizedApplicationsCardQuery,
    AuthorizedApplicationsCardFragment$key
  >(
    graphql`
      fragment AuthorizedApplicationsCardFragment on User
      @refetchable(queryName: "AuthorizedApplicationsCardQuery") {
        id
        oauth2Grants {
          id
          clientName
          clientId
          isFirstParty
          scopes
          createdAt
          expiresAt
          lastUsedAt
        }
      }
    `,
    viewer
  );
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const { fullTimeFormatter } = useTimeFormatters();
  const [commit, isCommitting] =
    useMutation<AuthorizedApplicationsCardRevokeMutation>(graphql`
      mutation AuthorizedApplicationsCardRevokeMutation(
        $input: RevokeOAuth2GrantInput!
      ) {
        revokeOAuth2Grant(input: $input) {
          grantId
          query {
            viewer {
              ...AuthorizedApplicationsCardFragment
            }
          }
        }
      }
    `);

  const grants = data.oauth2Grants;

  return (
    <Card
      title="Authorized Applications"
      subTitle="Applications that can access Phoenix with your authorization."
    >
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {grants.length === 0 ? (
        <EmptyState
          graphic={<EmptyStateGraphic variant="credential" />}
          description="No authorized applications"
        />
      ) : (
        <ul css={authorizedApplicationsListCSS}>
          {grants.map((grant) => {
            const isReadOnly = grant.scopes.includes("read_only");
            return (
              <li key={grant.id} css={authorizedApplicationCSS}>
                <div>
                  <Flex direction="row" gap="size-100" alignItems="center" wrap>
                    <Text weight="heavy">{grant.clientName}</Text>
                    {isReadOnly ? (
                      <Badge variant="info">Read-only</Badge>
                    ) : null}
                    {!grant.isFirstParty ? (
                      <Badge variant="default" overflowMode="truncate">
                        client ...{getClientIdSuffix(grant.clientId)}
                      </Badge>
                    ) : null}
                  </Flex>
                  <ul css={authorizedApplicationMetadataCSS}>
                    <li>
                      <span css={metadataLabelCSS}>Created</span>
                      <Text size="XS">
                        {formatTimestamp(grant.createdAt, fullTimeFormatter)}
                      </Text>
                    </li>
                    <li>
                      <span css={metadataLabelCSS}>Expires</span>
                      <Text size="XS">
                        {formatTimestamp(grant.expiresAt, fullTimeFormatter)}
                      </Text>
                    </li>
                    <li>
                      <span css={metadataLabelCSS}>Last used</span>
                      <Text size="XS">
                        {formatTimestamp(grant.lastUsedAt, fullTimeFormatter)}
                      </Text>
                    </li>
                  </ul>
                </div>
                <Flex direction="row" alignItems="center">
                  <Button
                    size="S"
                    variant="danger"
                    isDisabled={isCommitting}
                    onPress={() => {
                      setError(null);
                      commit({
                        variables: {
                          input: {
                            id: grant.id,
                          },
                        },
                        onCompleted: () => {
                          notifySuccess({
                            title: "Application access revoked",
                            message:
                              "The application can no longer access Phoenix.",
                          });
                          startTransition(() => {
                            refetch(
                              {},
                              {
                                fetchPolicy: "network-only",
                              }
                            );
                          });
                        },
                        onError: (error) => {
                          const formattedError =
                            getErrorMessagesFromRelayMutationError(error);
                          setError(formattedError?.[0] ?? error.message);
                        },
                      });
                    }}
                  >
                    Revoke
                  </Button>
                </Flex>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
