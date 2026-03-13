import { getLocalTimeZone } from "@internationalized/date";
import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import type { APIKeyFormParams } from "@phoenix/components/auth";
import {
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";

import type { APIKeysTableFragment$key } from "./__generated__/APIKeysTableFragment.graphql";
import type {
  ViewerAPIKeysCreateUserAPIKeyMutation,
  ViewerAPIKeysCreateUserAPIKeyMutation$data,
} from "./__generated__/ViewerAPIKeysCreateUserAPIKeyMutation.graphql";
import { APIKeysTable } from "./APIKeysTable";

export function ViewerAPIKeys({
  viewer,
}: {
  viewer: APIKeysTableFragment$key;
}) {
  const [showCreateAPIKeyResponse, setShowCreateAPIKeyResponse] =
    useState<ViewerAPIKeysCreateUserAPIKeyMutation$data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [commit, isCommitting] =
    useMutation<ViewerAPIKeysCreateUserAPIKeyMutation>(graphql`
      mutation ViewerAPIKeysCreateUserAPIKeyMutation($input: CreateUserApiKeyInput!) {
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
    (data: APIKeyFormParams, onCloseCreateAPIKeyDialog: () => void) => {
      commit({
        variables: {
          input: {
            ...data,
            expiresAt:
              data.expiresAt?.toDate(getLocalTimeZone()).toISOString() || null,
          },
        },
        onCompleted: (response) => {
          onCloseCreateAPIKeyDialog();
          setShowCreateAPIKeyResponse(response);
        },
        onError: (error) => {
          setError(error.message);
        },
      });
    },
    [commit]
  );
  return (
    <>
      <Card
        title="API Keys"
        extra={
          <DialogTrigger>
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
            >
              New Key
            </Button>
            <ModalOverlay>
              <Modal size="M">
                <CreateAPIKeyDialog
                  onSubmit={onSubmit}
                  isCommitting={isCommitting}
                />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        }
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <APIKeysTable query={viewer} />
      </Card>
      <DialogTrigger
        isOpen={!!showCreateAPIKeyResponse}
        onOpenChange={() => setShowCreateAPIKeyResponse(null)}
      >
        <ModalOverlay>
          <Modal size="L">
            <OneTimeAPIKeyDialog
              jwt={showCreateAPIKeyResponse?.createUserApiKey?.jwt ?? ""}
            />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}
