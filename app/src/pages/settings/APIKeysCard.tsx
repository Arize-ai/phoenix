import React, { ReactNode, Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Button,
  DialogContainer,
  Icon,
  Icons,
  TabbedCard,
  TabPane,
  Tabs,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import {
  APIKeyFormParams,
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";
import { useNotifyError } from "@phoenix/contexts";

import { APIKeysCardCreateSystemAPIKeyMutation } from "./__generated__/APIKeysCardCreateSystemAPIKeyMutation.graphql";
import { APIKeysCardQuery } from "./__generated__/APIKeysCardQuery.graphql";
import { SystemAPIKeysTable } from "./SystemAPIKeysTable";
import { UserAPIKeysTable } from "./UserAPIKeysTable";

function APIKeysCardContent() {
  const query = useLazyLoadQuery<APIKeysCardQuery>(
    graphql`
      query APIKeysCardQuery {
        ...SystemAPIKeysTableFragment
        ...UserAPIKeysTableFragment
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );

  return (
    <Tabs>
      <TabPane title="System Keys" name="System Keys">
        <SystemAPIKeysTable query={query} />
      </TabPane>
      <TabPane title="User Keys" name="User Keys">
        <UserAPIKeysTable query={query} />
      </TabPane>
    </Tabs>
  );
}

export function APIKeysCard() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifyError = useNotifyError();
  const showOneTimeAPIKeyDialog = (jwt: string) => {
    setDialog(<OneTimeAPIKeyDialog jwt={jwt} />);
  };

  const [commit, isCommitting] =
    useMutation<APIKeysCardCreateSystemAPIKeyMutation>(graphql`
      mutation APIKeysCardCreateSystemAPIKeyMutation(
        $name: String!
        $description: String = null
        $expiresAt: DateTime = null
      ) {
        createSystemApiKey(
          input: {
            name: $name
            description: $description
            expiresAt: $expiresAt
          }
        ) {
          jwt
          query {
            ...SystemAPIKeysTableFragment
          }
          apiKey {
            id
          }
        }
      }
    `);

  const onSubmit = useCallback(
    (data: APIKeyFormParams) => {
      commit({
        variables: {
          ...data,
          expiresAt: data.expiresAt || null,
        },
        onCompleted: (response) => {
          showOneTimeAPIKeyDialog(response.createSystemApiKey.jwt);
        },
        onError: (error) => {
          notifyError({
            title: "Error creating system key",
            message: error.message,
          });
        },
      });
    },
    [commit, notifyError]
  );
  const showCreateSystemAPIKeyDialog = () => {
    setDialog(
      <CreateAPIKeyDialog
        onSubmit={onSubmit}
        isCommitting={isCommitting}
        defaultName="System"
      />
    );
  };

  return (
    <div>
      <TabbedCard
        title="API Keys"
        variant="compact"
        extra={
          <Button
            variant="default"
            size="compact"
            icon={<Icon svg={<Icons.PlusCircleOutline />} />}
            onClick={showCreateSystemAPIKeyDialog}
          >
            System Key
          </Button>
        }
      >
        <Suspense
          fallback={
            <View padding="size-100">
              <Loading />
            </View>
          }
        >
          <APIKeysCardContent />
        </Suspense>
      </TabbedCard>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
