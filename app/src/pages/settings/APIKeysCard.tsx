import { getLocalTimeZone } from "@internationalized/date";
import { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  DialogTrigger,
  DocumentationHelp,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import type { APIKeyFormParams } from "@phoenix/components/auth";
import {
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";

import type { APIKeysCardCreateSystemAPIKeyMutation } from "./__generated__/APIKeysCardCreateSystemAPIKeyMutation.graphql";
import type { APIKeysCardQuery } from "./__generated__/APIKeysCardQuery.graphql";
import { SystemAPIKeysTable } from "./SystemAPIKeysTable";

function APIKeysCardContent({ fetchKey }: { fetchKey: number }) {
  const query = useLazyLoadQuery<APIKeysCardQuery>(
    graphql`
      query APIKeysCardQuery {
        ...SystemAPIKeysTableFragment
      }
    `,
    {},
    { fetchPolicy: "network-only", fetchKey }
  );

  return <SystemAPIKeysTable query={query} />;
}

export function APIKeysCard() {
  const [showCreateAPIKeyDialog, setShowCreateAPIKeyDialog] = useState(false);
  const [showOneTimeAPIKeyJwt, setShowOneTimeAPIKeyJwt] = useState<
    string | null
  >(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          setFetchKey((prev) => prev + 1);
          setShowCreateAPIKeyDialog(false);
          setShowOneTimeAPIKeyJwt(response.createSystemApiKey.jwt);
        },
        onError: (error) => {
          setError(error.message);
        },
      });
    },
    [commit]
  );

  return (
    <div>
      <Card
        title="System API Keys"
        titleExtra={
          <DocumentationHelp topic="apiKeys">
            Create system-wide credentials for automated and programmatic access
            to Phoenix.
          </DocumentationHelp>
        }
        extra={
          <DialogTrigger
            isOpen={showCreateAPIKeyDialog}
            onOpenChange={() => setShowCreateAPIKeyDialog(false)}
          >
            <Button
              size="S"
              variant="primary"
              onPress={() => setShowCreateAPIKeyDialog(true)}
              leadingVisual={<Icon svg={<Icons.Plus />} />}
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
        {error && <Alert variant="danger">{error}</Alert>}
        <Suspense
          fallback={
            <View padding="size-100">
              <Loading />
            </View>
          }
        >
          <APIKeysCardContent fetchKey={fetchKey} />
        </Suspense>
      </Card>
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
