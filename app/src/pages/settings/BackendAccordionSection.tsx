import { css } from "@emotion/react";
import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  DialogTrigger,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
} from "@phoenix/components";

import type { BackendAccordionSectionToggleInstanceMutation } from "./__generated__/BackendAccordionSectionToggleInstanceMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";
import { BackendHeader } from "./BackendHeader";
import { ConfigInstanceList } from "./ConfigInstanceList";
import { CredentialDialog } from "./CredentialDialog";
import { SetupDialog } from "./SetupDialog";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

type StatusDisplay = {
  label: string;
  color: string;
  icon: boolean;
};

export function BackendAccordionSection({
  adapter,
  display,
  sandboxEnabled,
  onRefetch,
}: {
  adapter: AdapterInfo;
  display: StatusDisplay;
  sandboxEnabled: boolean;
  onRefetch: () => void;
}) {
  const [commitUpdateInstance] =
    useMutation<BackendAccordionSectionToggleInstanceMutation>(graphql`
      mutation BackendAccordionSectionToggleInstanceMutation(
        $input: UpdateSandboxConfigInput!
      ) {
        updateSandboxConfig(input: $input) {
          id
          enabled
        }
      }
    `);

  const handleInstanceToggle = useCallback(
    ({ id, enabled }: { id: string; enabled: boolean }) => {
      commitUpdateInstance({
        variables: { input: { id, enabled } },
        onCompleted: () => onRefetch(),
      });
    },
    [commitUpdateInstance, onRefetch]
  );

  return (
    <Disclosure
      id={adapter.key}
      css={
        !sandboxEnabled
          ? css`
              opacity: 0.5;
              pointer-events: none;
            `
          : undefined
      }
    >
      <DisclosureTrigger>
        <BackendHeader adapter={adapter} display={display} />
      </DisclosureTrigger>
      <DisclosurePanel>
        <Flex direction="column" gap="size-0">
          {/* Credential management section */}
          {adapter.envVars.length > 0 && (
            <Flex
              direction="row"
              alignItems="center"
              gap="size-100"
              css={css`
                padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
                border-bottom: 1px solid var(--global-border-color-default);
              `}
            >
              <Text size="S" color="text-700" flex="1 1 auto">
                Credentials
              </Text>
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Configure credentials for ${adapter.label}`}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                >
                  Configure
                </Button>
                <ModalOverlay>
                  <Modal size="M">
                    <CredentialDialog adapter={adapter} onSaved={onRefetch} />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          )}
          {/* Setup instructions section */}
          {adapter.setupInstructions.length > 0 && (
            <Flex
              direction="row"
              alignItems="center"
              gap="size-100"
              css={css`
                padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
                border-bottom: 1px solid var(--global-border-color-default);
              `}
            >
              <Text size="S" color="text-700" flex="1 1 auto">
                Setup instructions
              </Text>
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Setup instructions for ${adapter.label}`}
                  leadingVisual={<Icon svg={<Icons.InfoOutline />} />}
                >
                  View
                </Button>
                <ModalOverlay>
                  <Modal size="M">
                    <SetupDialog adapter={adapter} />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          )}
          {/* Config instance list */}
          <ConfigInstanceList
            adapter={adapter}
            sandboxEnabled={sandboxEnabled}
            onToggleInstance={handleInstanceToggle}
            onRefetch={onRefetch}
          />
        </Flex>
      </DisclosurePanel>
    </Disclosure>
  );
}
