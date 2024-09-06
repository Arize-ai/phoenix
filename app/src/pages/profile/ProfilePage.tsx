import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  DialogContainer,
  Flex,
  Form,
  Icon,
  Icons,
  TextField,
} from "@arizeai/components";

import {
  APIKeyFormParams,
  CreateAPIKeyDialog,
  OneTimeAPIKeyDialog,
} from "@phoenix/components/auth";
import { useNotifyError } from "@phoenix/contexts";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ProfilePageCreateUserAPIKeyMutation } from "./__generated__/ProfilePageCreateUserAPIKeyMutation.graphql";
import { APIKeysTable } from "./APIKeysTable";

const profilePageCSS = css`
  overflow-y: auto;
`;

const profilePageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

export function ProfilePage() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifyError = useNotifyError();
  const { viewer } = useViewer();

  const [commit, isCommitting] =
    useMutation<ProfilePageCreateUserAPIKeyMutation>(graphql`
      mutation ProfilePageCreateUserAPIKeyMutation(
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
            expiresAt: data.expiresAt || null,
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

  if (!viewer) {
    return null;
  }
  return (
    <main css={profilePageCSS}>
      <div css={profilePageInnerCSS}>
        {/* TODO(auth): Change username, etc. */}
        {/* TODO(auth): Reset password */}
        <Flex direction="column" gap="size-200">
          <Card title="Profile" variant="compact">
            <Form>
              <TextField label="email" value={viewer.email} isReadOnly />
              <TextField
                label="username"
                value={viewer.username || ""}
                isReadOnly
              />
              <TextField
                label="role"
                value={viewer.role.name || ""}
                isReadOnly
              />
            </Form>
          </Card>
          <Card
            title="API Keys"
            variant="compact"
            bodyStyle={{ padding: 0 }}
            extra={
              <Button
                variant="default"
                size="compact"
                icon={<Icon svg={<Icons.PlusCircleOutline />} />}
                onClick={() =>
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
          </Card>
        </Flex>
        <DialogContainer
          onDismiss={() => {
            setDialog(null);
          }}
        >
          {dialog}
        </DialogContainer>
      </div>
    </main>
  );
}
