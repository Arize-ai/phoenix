import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Dialog,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";
import {
  LDAPUserForm,
  LDAPUserFormParams,
} from "@phoenix/components/settings/LDAPUserForm";
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

  const onSubmitLdapUser = useCallback(
    (data: LDAPUserFormParams) => {
      commit({
        variables: {
          input: {
            email: data.email,
            username: data.username,
            role: data.role,
            authMethod: "LDAP",
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

  // Determine which tabs are available
  const showLocalTab = !window.Config.basicAuthDisabled;
  const showOAuth2Tab = window.Config.oAuth2Idps.length > 0;
  const showLDAPTab = window.Config.ldapEnabled;

  // Smart default tab selection
  const defaultTab = showLocalTab
    ? "local"
    : showOAuth2Tab
      ? "oauth2"
      : showLDAPTab
        ? "ldap"
        : "local"; // Fallback (should never happen due to backend validation)

  return (
    <ModalOverlay
      isOpen={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onDismiss();
        }
      }}
    >
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogCloseButton />
            </DialogHeader>
            <Tabs defaultSelectedKey={defaultTab}>
              <TabList>
                {showLocalTab && <Tab id="local">Local</Tab>}
                {showOAuth2Tab && <Tab id="oauth2">OAuth2</Tab>}
                {showLDAPTab && <Tab id="ldap">LDAP</Tab>}
              </TabList>
              {showLocalTab && (
                <TabPanel id="local">
                  <UserForm
                    key="user-form"
                    onSubmit={onSubmit}
                    isSubmitting={isCommitting}
                  />
                </TabPanel>
              )}
              {showOAuth2Tab && (
                <TabPanel id="oauth2">
                  <OAuthUserForm
                    key="oauth-form"
                    onSubmit={onSubmitOauthUser}
                    isSubmitting={isCommitting}
                  />
                </TabPanel>
              )}
              {showLDAPTab && (
                <TabPanel id="ldap">
                  <LDAPUserForm
                    key="ldap-form"
                    onSubmit={onSubmitLdapUser}
                    isSubmitting={isCommitting}
                  />
                </TabPanel>
              )}
            </Tabs>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
