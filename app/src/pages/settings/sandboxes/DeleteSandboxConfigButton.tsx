import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeleteSandboxConfigButtonDeleteSandboxConfigMutation } from "./__generated__/DeleteSandboxConfigButtonDeleteSandboxConfigMutation.graphql";
import type { SandboxConfig } from "./types";

export function DeleteSandboxConfigButton({
  config,
}: {
  config: SandboxConfig;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [commitDelete, isDeleting] =
    useMutation<DeleteSandboxConfigButtonDeleteSandboxConfigMutation>(graphql`
      mutation DeleteSandboxConfigButtonDeleteSandboxConfigMutation($id: ID!) {
        deleteSandboxConfig(id: $id) {
          deletedId
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  const handleDelete = useCallback(() => {
    setError(null);
    commitDelete({
      variables: { id: config.id },
      onCompleted: () => {
        setIsOpen(false);
        notifySuccess({
          title: "Config deleted",
          message: `${config.name} was deleted.`,
        });
      },
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
            "Failed to delete sandbox config"
        );
      },
    });
  }, [commitDelete, config.id, config.name, notifySuccess]);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        variant="danger"
        aria-label={`Delete ${config.name}`}
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Sandbox Config</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <div>
                  {error ? (
                    <Alert variant="danger" banner>
                      {error}
                    </Alert>
                  ) : null}
                  <Text color="danger">
                    Deleting {config.name} will remove it from any evaluators
                    that currently reference it.
                  </Text>
                </div>
              </View>
              <DialogFooter>
                <Button
                  variant="default"
                  onPress={() => setIsOpen(false)}
                  size="S"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={handleDelete}
                  isDisabled={isDeleting}
                  size="S"
                >
                  Delete Config
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
