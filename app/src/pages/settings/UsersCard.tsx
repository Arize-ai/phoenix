import React, { ReactNode, Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Card,
  DialogContainer,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { UsersCardQuery } from "./__generated__/UsersCardQuery.graphql";
import { NewUserDialog } from "./NewUserDialog";
import { UsersTable } from "./UsersTable";

export function UsersCard() {
  const [fetchKey, setFetchKey] = useState(0);
  const [dialog, setDialog] = useState<ReactNode>(null);

  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

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
      variant="compact"
      bodyStyle={{ padding: 0, overflowX: "auto" }}
      extra={
        <Button
          onClick={() => {
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
                  notifyError({
                    title: "Error adding user",
                    message: error.message,
                  });
                }}
              />
            );
          }}
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.PlusCircleOutline />} />}
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
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </Card>
  );
}
