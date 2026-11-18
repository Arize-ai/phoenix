import { css } from "@emotion/react";
import { useCallback, useContext } from "react";
import { OverlayTriggerStateContext } from "react-aria-components";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import {
  ProviderBrowserCredentialsPanel,
  ProviderServerCredentialsPanel,
} from "@phoenix/components/generative";
import type { ProviderServerCredentialsPanelProvider } from "@phoenix/components/generative/ProviderServerCredentialsPanel";
import { useViewer } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

function CredentialsSetIndicator() {
  return (
    <Icon
      color="success"
      svg={<Icons.Checkmark />}
      aria-label="credentials set"
      css={css`
        font-size: var(--global-font-size-s);
      `}
    />
  );
}

/**
 * Edits a built-in provider's credentials, in this browser or on the server.
 * Render inside a modal: saving closes the enclosing overlay.
 */
export function ProviderCredentialsDialog({
  provider,
}: {
  provider: ProviderServerCredentialsPanelProvider;
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const providerKey = provider.key;
  const hasBrowserCredentials = useCredentialsContext((state) => {
    if (!isModelProvider(providerKey)) {
      return false;
    }
    const providerCredentials = state[providerKey];
    return provider.credentialRequirements.some(
      ({ envVarName }) => !!providerCredentials?.[envVarName]
    );
  });
  const overlayState = useContext(OverlayTriggerStateContext);
  const closeDialog = useCallback(() => {
    overlayState?.close();
  }, [overlayState]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {provider.name} Credentials</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        {isAdmin ? (
          <>
            <View paddingX="size-200" paddingY="size-100">
              <Text size="XS" color="text-700">
                Credentials can be stored in two places: in this browser for
                your personal use, and on the server to share with all users.
              </Text>
            </View>
            <Tabs defaultSelectedKey="browser">
              <TabList aria-label="Credential storage location">
                <Tab id="browser">
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Text>Browser</Text>
                    {hasBrowserCredentials && <CredentialsSetIndicator />}
                  </Flex>
                </Tab>
                <Tab id="server">
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Text>Server</Text>
                    {provider.credentialsSet && <CredentialsSetIndicator />}
                  </Flex>
                </Tab>
              </TabList>
              <LazyTabPanel id="browser">
                <View padding="size-200">
                  <ProviderBrowserCredentialsPanel
                    provider={provider}
                    onSaved={closeDialog}
                  />
                </View>
              </LazyTabPanel>
              <LazyTabPanel id="server">
                <View padding="size-200">
                  <ProviderServerCredentialsPanel
                    provider={provider}
                    onSaved={closeDialog}
                  />
                </View>
              </LazyTabPanel>
            </Tabs>
          </>
        ) : (
          <View padding="size-200" paddingTop="size-100">
            <Flex direction="column" gap="size-100">
              <Text size="XS" color="text-700">
                To configure shared credentials for all users on the server,
                contact an administrator.
              </Text>
              <ProviderBrowserCredentialsPanel
                provider={provider}
                onSaved={closeDialog}
              />
            </Flex>
          </View>
        )}
      </DialogContent>
    </Dialog>
  );
}
