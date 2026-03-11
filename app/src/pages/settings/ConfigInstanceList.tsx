import { css } from "@emotion/react";
import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Switch,
  Text,
  View,
} from "@phoenix/components";

import type { ConfigInstanceListDeleteMutation } from "./__generated__/ConfigInstanceListDeleteMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";
import { CreateInstanceDialog } from "./CreateInstanceDialog";
import { EditInstanceDialog } from "./EditInstanceDialog";
import { EditTimeoutDialog } from "./EditTimeoutDialog";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];
type ConfigInstanceInfo = AdapterInfo["configs"][number];

const instanceRowCSS = css`
  background: var(--ac-global-color-grey-75);
`;

export function ConfigInstanceList({
  adapter,
  sandboxEnabled,
  onToggleInstance,
  onRefetch,
}: {
  adapter: AdapterInfo;
  sandboxEnabled: boolean;
  onToggleInstance: ({ id, enabled }: { id: string; enabled: boolean }) => void;
  onRefetch: () => void;
}) {
  const [commitDelete] = useMutation<ConfigInstanceListDeleteMutation>(graphql`
    mutation ConfigInstanceListDeleteMutation($id: ID!) {
      deleteSandboxConfig(id: $id) {
        id
      }
    }
  `);

  const handleDelete = useCallback(
    (instance: ConfigInstanceInfo) => {
      commitDelete({
        variables: { id: instance.id },
        onCompleted: () => onRefetch(),
      });
    },
    [commitDelete, onRefetch]
  );

  return (
    <Flex direction="column" gap="size-0">
      {/* Config instance list header */}
      {adapter.configRequired && (
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
            Configurations
          </Text>
          <DialogTrigger>
            <Button
              size="S"
              aria-label={`Add config for ${adapter.label}`}
              leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
            >
              Add
            </Button>
            <ModalOverlay>
              <Modal size="M">
                <CreateInstanceDialog adapter={adapter} onSaved={onRefetch} />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </Flex>
      )}
      {/* Empty state */}
      {adapter.configRequired && adapter.configs.length === 0 && (
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="center"
          css={css`
            padding: var(--global-dimension-size-200);
          `}
        >
          <Text size="S" color="text-300">
            No configurations. Click &ldquo;Add&rdquo; to create one.
          </Text>
        </Flex>
      )}
      {/* Config instance rows */}
      {adapter.configs.map((instance: ConfigInstanceInfo) => (
        <Flex
          key={instance.id}
          direction="row"
          alignItems="center"
          gap="size-100"
          css={css(
            instanceRowCSS,
            css`
              padding: var(--global-dimension-size-50) var(--global-dimension-size-200);
            `
          )}
        >
          <View flex="1 1 auto">
            <Text size="S">{instance.name}</Text>
          </View>
          <View flex="2 1 auto">
            <Text size="XS" color="text-500">
              {instance.description || "--"}
            </Text>
          </View>
          <Text size="XS" color="text-500">
            timeout: {instance.timeout}s
          </Text>
          <Switch
            isSelected={instance.enabled}
            onChange={(enabled) =>
              onToggleInstance({ id: instance.id, enabled })
            }
            aria-label={`Enable config ${instance.name}`}
            isDisabled={!sandboxEnabled}
          >
            {null}
          </Switch>
          {adapter.configRequired ? (
            <>
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Edit config ${instance.name}`}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                />
                <ModalOverlay>
                  <Modal size="M">
                    <EditInstanceDialog
                      adapter={adapter}
                      instance={instance}
                      allowDelete={false}
                      onSaved={onRefetch}
                    />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Delete config ${instance.name}`}
                  leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                />
                <ModalOverlay>
                  <Modal size="S">
                    <Dialog>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete {instance.name}?</DialogTitle>
                          <DialogTitleExtra>
                            <DialogCloseButton slot="close" />
                          </DialogTitleExtra>
                        </DialogHeader>
                        <View padding="size-200">
                          <Flex direction="column" gap="size-200">
                            <Text size="S" color="text-700">
                              Any code evaluators using this configuration will
                              lose their sandbox assignment.
                            </Text>
                            <Flex direction="row" gap="size-100">
                              <Button
                                variant="danger"
                                onPress={() => handleDelete(instance)}
                              >
                                Delete
                              </Button>
                            </Flex>
                          </Flex>
                        </View>
                      </DialogContent>
                    </Dialog>
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </>
          ) : (
            <DialogTrigger>
              <Button
                size="S"
                aria-label={`Edit timeout for ${instance.name}`}
                leadingVisual={<Icon svg={<Icons.EditOutline />} />}
              />
              <ModalOverlay>
                <Modal size="M">
                  <EditTimeoutDialog
                    adapter={adapter}
                    instance={instance}
                    onSaved={onRefetch}
                  />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
