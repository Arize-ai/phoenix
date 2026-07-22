import { css } from "@emotion/react";
import { formatDistance } from "date-fns";
import { startTransition, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import {
  Alert,
  Badge,
  Button,
  Card,
  ContextualHelp,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { OAuth2ClientIcon } from "@phoenix/components/auth";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
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

const grantScopesListCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-50) 0 0;
  padding: 0;
`;

function getClientIdSuffix(clientId: string) {
  return clientId.length > 8 ? clientId.slice(-8) : clientId;
}

function GrantScopesHelp({ scopes }: { scopes: readonly string[] }) {
  return (
    <ContextualHelp variant="info">
      <Heading weight="heavy" level={4}>
        Scopes
      </Heading>
      {scopes.length > 0 ? (
        <ul css={grantScopesListCSS}>
          {scopes.map((scope) => (
            <li key={scope}>
              <code>{scope}</code>
            </li>
          ))}
        </ul>
      ) : (
        <Text>Unspecified</Text>
      )}
    </ContextualHelp>
  );
}

function GrantTimestamp({
  value,
  formatter,
  now,
}: {
  value: string | null | undefined;
  formatter: (date: Date) => string;
  /**
   * When provided, renders the timestamp as a relative distance from now
   * ("3 minutes ago") with the absolute time available on hover.
   */
  now?: Date;
}) {
  if (!value) {
    return <Text size="XS">Never</Text>;
  }
  const date = new Date(value);
  if (now) {
    return (
      <Text size="XS" title={formatter(date)}>
        {formatDistance(date, now, { addSuffix: true })}
      </Text>
    );
  }
  return <Text size="XS">{formatter(date)}</Text>;
}

function GrantActionMenu({
  clientName,
  isDisabled,
  onRevoke,
}: {
  clientName: string;
  isDisabled: boolean;
  onRevoke: () => void;
}) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  return (
    <>
      <MenuTrigger>
        <Button
          size="S"
          isDisabled={isDisabled}
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
          aria-label={`Actions for ${clientName}`}
        />
        <Popover placement="bottom end">
          <Menu
            onAction={(action) => {
              if (action === "revoke") {
                setShowRevokeDialog(true);
              }
            }}
          >
            <MenuItem id="revoke" textValue="Revoke access">
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.MinusCircle />} />
                <Text>Revoke access</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
      >
        <ModalOverlay isDismissable>
          <Modal>
            <Dialog>
              {({ close }) => (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke access for {clientName}</DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton slot="close" />
                    </DialogTitleExtra>
                  </DialogHeader>
                  <View padding="size-200">
                    <Text>
                      <b>{clientName}</b> will immediately lose access to
                      Phoenix and will need to be authorized again to reconnect.
                    </Text>
                  </View>
                  <View
                    paddingEnd="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-100"
                    borderTopColor="default"
                    borderTopWidth="thin"
                  >
                    <Flex direction="row" justifyContent="end" gap="size-100">
                      <Button slot="close" size="S">
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="S"
                        onPress={() => {
                          close();
                          onRevoke();
                        }}
                      >
                        Revoke access
                      </Button>
                    </Flex>
                  </View>
                </DialogContent>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}

export function AuthorizedApplicationsCard({
  viewer,
  userName,
}: {
  viewer: AuthorizedApplicationsCardFragment$key;
  userName?: string;
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
        $userId: ID!
      ) {
        revokeOAuth2Grant(input: $input) {
          grantId
          query {
            node(id: $userId) {
              ... on User {
                oauth2GrantCount
                ...AuthorizedApplicationsCardFragment
              }
            }
          }
        }
      }
    `);

  const grants = data.oauth2Grants;
  const now = new Date();

  return (
    <Card
      title="Authorized Applications"
      titleExtra={
        <ContextualHelp variant="info">
          <Heading weight="heavy" level={4}>
            Authorized Applications
          </Heading>
          <Text>
            Authorized applications are OAuth 2.0 grants that allow an
            application to access Phoenix on a user&apos;s behalf. Revoking a
            grant immediately ends that application&apos;s access.
          </Text>
        </ContextualHelp>
      }
    >
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {grants.length === 0 ? (
        <View padding="size-500">
          <EmptyState
            graphic={<EmptyStateGraphic variant="credential" />}
            title="No authorized applications"
            description={
              userName
                ? `${userName} has not authorized any applications.`
                : "Applications you approve, like the Phoenix CLI, will appear here."
            }
          />
        </View>
      ) : (
        <ul css={authorizedApplicationsListCSS}>
          {grants.map((grant) => {
            const isExpired =
              grant.expiresAt != null && new Date(grant.expiresAt) < now;
            return (
              <li key={grant.id} css={authorizedApplicationCSS}>
                <OAuth2ClientIcon
                  clientName={grant.clientName}
                  isFirstParty={grant.isFirstParty}
                />
                <div>
                  <Flex direction="row" gap="size-100" alignItems="center" wrap>
                    <Text weight="heavy">{grant.clientName}</Text>
                    <GrantScopesHelp scopes={grant.scopes} />
                    {isExpired ? (
                      <Badge variant="warning">Expired</Badge>
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
                      <GrantTimestamp
                        value={grant.createdAt}
                        formatter={fullTimeFormatter}
                      />
                    </li>
                    <li>
                      <span css={metadataLabelCSS}>
                        {isExpired ? "Expired" : "Expires"}
                      </span>
                      <GrantTimestamp
                        value={grant.expiresAt}
                        formatter={fullTimeFormatter}
                      />
                    </li>
                    <li>
                      <span css={metadataLabelCSS}>Last used</span>
                      <GrantTimestamp
                        value={grant.lastUsedAt}
                        formatter={fullTimeFormatter}
                        now={now}
                      />
                    </li>
                  </ul>
                </div>
                <GrantActionMenu
                  clientName={grant.clientName}
                  isDisabled={isCommitting}
                  onRevoke={() => {
                    setError(null);
                    commit({
                      variables: {
                        input: {
                          id: grant.id,
                        },
                        userId: data.id,
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
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
