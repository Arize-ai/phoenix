import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { Dialog, DialogContainer } from "@arizeai/components";

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
    <DialogContainer
      onDismiss={onDismiss}
      isDismissable
      type="modal"
      isKeyboardDismissDisabled
    >
      <Dialog title="Add user">
        <UserForm onSubmit={onSubmit} isSubmitting={isCommitting} />
      </Dialog>
    </DialogContainer>
  );
}
