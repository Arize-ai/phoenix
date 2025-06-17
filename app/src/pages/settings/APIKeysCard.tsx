import { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { getLocalTimeZone } from "@internationalized/date";

import { TabbedCard } from "@arizeai/components";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  Tabs,
  View,
} from "@phoenix/components";
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
      <TabList>
        <Tab id="system">System Keys</Tab>
        <Tab id="user">User Keys</Tab>
      </TabList>
      <LazyTabPanel id="system">
        <SystemAPIKeysTable query={query} />
      </LazyTabPanel>
      <LazyTabPanel id="user">
        <UserAPIKeysTable query={query} />
      </LazyTabPanel>
    </Tabs>
  );
}

export function APIKeysCard() {
  const [showCreateAPIKeyDialog, setShowCreateAPIKeyDialog] = useState(false);
  const [showOneTimeAPIKeyJwt, setShowOneTimeAPIKeyJwt] = useState<
    string | null
  >(null);
  const notifyError = useNotifyError();

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
          expiresAt:
            data.expiresAt?.toDate(getLocalTimeZone()).toISOString() || null,
        },
        onCompleted: (response) => {
          setShowCreateAPIKeyDialog(false);
          setShowOneTimeAPIKeyJwt(response.createSystemApiKey.jwt);
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

  return (
    <div>
      <TabbedCard
        title="API Keys"
        variant="compact"
        extra={
          <DialogTrigger
            isOpen={showCreateAPIKeyDialog}
            onOpenChange={() => setShowCreateAPIKeyDialog(false)}
          >
            <Button
              size="S"
              onPress={() => setShowCreateAPIKeyDialog(true)}
              leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
            >
              System Key
            </Button>
            <ModalOverlay>
              <Modal size="M">
                <CreateAPIKeyDialog
                  onSubmit={onSubmit}
                  isCommitting={isCommitting}
                  defaultName="System"
                />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
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
      <DialogTrigger
        isOpen={!!showOneTimeAPIKeyJwt}
        onOpenChange={() => setShowOneTimeAPIKeyJwt(null)}
      >
        <ModalOverlay>
          <Modal size="L">
            <OneTimeAPIKeyDialog jwt={showOneTimeAPIKeyJwt ?? ""} />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}
