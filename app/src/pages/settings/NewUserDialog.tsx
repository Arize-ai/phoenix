import React, { useCallback } from "react";

import { Dialog } from "@arizeai/components";

import {
  UserForm,
  UserFormParams,
} from "@phoenix/components/settings/UserForm";

export function NewUserDialog() {
  const onSubmit = useCallback((data: UserFormParams) => {
    // currently no mutation implemented
  }, []);
  //   const [commit, isCommitting] = useMutation(graphql`
  //     mutation NewUserDialogMutation($input: CreateUserInput!) {
  //       createUser(input: $input) {
  //         user {
  //           id
  //         }
  //       }
  //     }
  //   `);

  return (
    <Dialog title="Create a user" isDismissable>
      <UserForm onSubmit={onSubmit} isSubmitting={false} />
    </Dialog>
  );
}
