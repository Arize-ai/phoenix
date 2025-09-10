import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { getLocalTimeZone } from "@internationalized/date";

import {
  Button,
  Card,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  APIKeyFormParams,
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";
import { useNotifyError } from "@phoenix/contexts";

import { APIKeysTableFragment$key } from "./__generated__/APIKeysTableFragment.graphql";
import {
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
