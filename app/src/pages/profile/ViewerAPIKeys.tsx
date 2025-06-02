import { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { getLocalTimeZone } from "@internationalized/date";

import { Card, DialogContainer } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";
import {
  APIKeyFormParams,
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";
import { useNotifyError } from "@phoenix/contexts";

import { APIKeysTableFragment$key } from "./__generated__/APIKeysTableFragment.graphql";
import { ViewerAPIKeysCreateUserAPIKeyMutation } from "./__generated__/ViewerAPIKeysCreateUserAPIKeyMutation.graphql";
import { APIKeysTable } from "./APIKeysTable";

export function ViewerAPIKeys({
  viewer,
}: {
  viewer: APIKeysTableFragment$key;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifyError = useNotifyError();

  const [commit, isCommitting] =
    useMutation<ViewerAPIKeysCreateUserAPIKeyMutation>(graphql`
      mutation ViewerAPIKeysCreateUserAPIKeyMutation(
        $input: CreateUserApiKeyInput!
      ) {
        createUserApiKey(input: $input) {
          jwt
          apiKey {
            id
            user {
              ...APIKeysTableFragment
            }
          }
        }
      }
    `);

  const onSubmit = useCallback(
    (data: APIKeyFormParams) => {
      commit({
        variables: {
          input: {
            ...data,
            expiresAt:
              data.expiresAt?.toDate(getLocalTimeZone()).toISOString() || null,
          },
        },
        onCompleted: (response) => {
          setDialog(
            <OneTimeAPIKeyDialog jwt={response.createUserApiKey.jwt} />
          );
        },
        onError: (error) => {
          notifyError({
            title: "Error creating API key",
            message: error.message,
          });
        },
      });
    },
    [commit, notifyError]
  );
  return (
    <Card
      title="API Keys"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
          onPress={() =>
            setDialog(
              <CreateAPIKeyDialog
                onSubmit={onSubmit}
                isCommitting={isCommitting}
              />
            )
          }
        >
          New Key
        </Button>
      }
    >
      <APIKeysTable query={viewer} />
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
