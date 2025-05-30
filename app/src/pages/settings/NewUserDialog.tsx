import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { Dialog, Modal } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";
import {
  OAuthUserForm,
  OAuthUserFormParams,
} from "@phoenix/components/settings/OAuthUserForm";
import {
  UserForm,
  UserFormParams,
} from "@phoenix/components/settings/UserForm";

import { NewUserDialogMutation } from "./__generated__/NewUserDialogMutation.graphql";

export function NewUserDialog({
  onNewUserCreated,
  onNewUserCreationError,
  onDismiss,
}: {
  onNewUserCreated: (email: string) => void;
  onNewUserCreationError: (error: Error) => void;
  onDismiss: () => void;
}) {
  const [commit, isCommitting] = useMutation<NewUserDialogMutation>(graphql`
    mutation NewUserDialogMutation($input: CreateUserInput!) {
      createUser(input: $input) {
        user {
          id
          email
        }
      }
    }
  `);

  const onSubmit = useCallback(
    (data: UserFormParams) => {
      commit({
        variables: {
          input: {
            email: data.email,
            username: data.username,
            password: data.password,
            role: data.role,
            authMethod: "LOCAL",
            sendWelcomeEmail: true,
          },
        },
        onCompleted: (response) => {
          onNewUserCreated(response.createUser.user.email);
        },
        onError: (error) => {
          onNewUserCreationError(error);
        },
      });
    },
    [commit, onNewUserCreated, onNewUserCreationError]
  );

  const onSubmitOauthUser = useCallback(
    (data: OAuthUserFormParams) => {
      commit({
        variables: {
          input: {
            email: data.email,
            username: data.username,
            role: data.role,
            authMethod: "OAUTH2",
            sendWelcomeEmail: true,
          },
        },
        onCompleted: (response) => {
          onNewUserCreated(response.createUser.user.email);
        },
        onError: (error) => {
          onNewUserCreationError(error);
        },
      });
    },
    [commit, onNewUserCreated, onNewUserCreationError]
  );

  return (
    <Modal
      isOpen={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onDismiss();
        }
      }}
      isDismissable
    >
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          {window.Config.basicAuthDisabled ? (
            <OAuthUserForm
              key="oauth-form"
              onSubmit={onSubmitOauthUser}
              isSubmitting={isCommitting}
            />
          ) : (
            <UserForm
              key="user-form"
              onSubmit={onSubmit}
              isSubmitting={isCommitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
