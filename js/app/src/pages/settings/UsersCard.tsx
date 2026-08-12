import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useRelayEnvironment,
} from "react-relay";

import {
  Alert,
  Button,
  Card,
  DocumentationHelp,
  Icon,
  Icons,
  Loading,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { UsersCardQuery } from "./__generated__/UsersCardQuery.graphql";
import { NewUserDialog } from "./NewUserDialog";
import { UsersTable } from "./UsersTable";

const usersCardContainerCSS = css`
  height: 100%;

  & > .card {
    max-height: 100%;
  }

  & .card__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
`;

const usersCardQuery = graphql`
  query UsersCardQuery {
    ...UsersTable_users
  }
`;

export function UsersCard() {
  const environment = useRelayEnvironment();
  const [fetchKey, setFetchKey] = useState(0);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);

  const notifySuccess = useNotifySuccess();

  const isDisabled = useMemo(() => {
    // Disable when no user creation method is available:
    // - Basic auth is disabled AND
    // - No OAuth2 IDPs configured AND
    // - LDAP manual user creation is disabled
    return (
      window.Config.basicAuthDisabled &&
      !window.Config.oAuth2Idps.length &&
      !window.Config.ldapManualUserCreationEnabled
    );
  }, []);

  const data = useLazyLoadQuery<UsersCardQuery>(
    usersCardQuery,
    {},
    {
      fetchKey: fetchKey,
      fetchPolicy: "store-and-network",
    }
  );

  return (
    <div css={usersCardContainerCSS}>
      <Card
        title="Users"
        titleExtra={
          <DocumentationHelp topic="userAccess">
            Add users and manage access to this Phoenix instance.
          </DocumentationHelp>
        }
        extra={
          <Button
            onPress={() => {
              setDialog(
                <NewUserDialog
                  onDismiss={() => {
                    setDialog(null);
                  }}
                  onNewUserCreated={(username) => {
                    setDialog(null);
                    notifySuccess({
                      title: "User added",
                      message: `User ${username} has been added.`,
                    });
                    // A fetchKey bump alone dedupes into any UsersCardQuery that
                    // was already in flight when the user was created, and that
                    // response predates the insert. Join such a fetch first so
                    // the bump below always issues a fresh network request.
                    const bump = () => setFetchKey((prev) => prev + 1);
                    fetchQuery<UsersCardQuery>(
                      environment,
                      usersCardQuery,
                      {}
                    ).subscribe({ complete: bump, error: bump });
                  }}
                  onNewUserCreationError={(error) => {
                    const formattedError =
                      getErrorMessagesFromRelayMutationError(error);
                    setError(formattedError?.[0] ?? error.message);
                  }}
                />
              );
            }}
            size="S"
            variant="primary"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isDisabled}
          >
            Add User
          </Button>
        }
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <Suspense
          fallback={
            <View padding="size-200">
              <Loading />
            </View>
          }
        >
          <UsersTable query={data} />
        </Suspense>
        {dialog}
      </Card>
    </div>
  );
}
