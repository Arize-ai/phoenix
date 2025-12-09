import { ReactNode, Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Button, Card, Icon, Icons, Loading, View } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { UsersCardQuery } from "./__generated__/UsersCardQuery.graphql";
import { NewUserDialog } from "./NewUserDialog";
import { UsersTable } from "./UsersTable";

export function UsersCard() {
  const [fetchKey, setFetchKey] = useState(0);
  const [dialog, setDialog] = useState<ReactNode>(null);

  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

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
    graphql`
      query UsersCardQuery {
        ...UsersTable_users
      }
    `,
    {},
    {
      fetchKey: fetchKey,
      fetchPolicy: "store-and-network",
    }
  );

  return (
    <Card
      title="Users"
      extra={
        <Button
          onPress={() => {
            setDialog(
              <NewUserDialog
                onDismiss={() => {
                  setDialog(null);
                }}
                onNewUserCreated={(email) => {
                  setDialog(null);
                  notifySuccess({
                    title: "User added",
                    message: `User ${email} has been added.`,
                  });
                  setFetchKey((prev) => prev + 1);
                }}
                onNewUserCreationError={(error) => {
                  const formattedError =
                    getErrorMessagesFromRelayMutationError(error);
                  notifyError({
                    title: "Error adding user",
                    message: formattedError?.[0] ?? error.message,
                  });
                }}
              />
            );
          }}
          size="S"
          leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
          isDisabled={isDisabled}
        >
          Add User
        </Button>
      }
    >
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
  );
}
