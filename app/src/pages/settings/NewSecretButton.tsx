import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

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
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewSecretButtonMutation } from "./__generated__/NewSecretButtonMutation.graphql";

function NewSecretDialogContent({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "SecretsCard_secrets"
  );

  const [commit, isCommitting] = useMutation<NewSecretButtonMutation>(graphql`
    mutation NewSecretButtonMutation(
      $input: UpsertSecretMutationInput!
      $connectionId: ID!
    ) {
      upsertSecret(input: $input) {
        secret
          @prependNode(
            connections: [$connectionId]
            edgeTypeName: "SecretEdge"
          ) {
          id
          key
          value
        }
        query {
          ...SecretsCard_data
        }
      }
    }
  `);

  const handleCreate = useCallback(() => {
    if (!key.trim() || !value.trim()) {
      notifyError({
        title: "Invalid input",
        message: "Key and value cannot be empty",
      });
      return;
    }

    commit({
      variables: {
        input: {
          key: key.trim(),
          value: value.trim(),
        },
        connectionId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Secret created",
          message: `Secret "${key}" has been created successfully.`,
        });
        onClose();
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to create secret",
          message: messages?.join(", ") || "An unknown error occurred",
        });
      },
    });
  }, [commit, key, value, connectionId, notifyError, notifySuccess, onClose]);

  return (
    <div>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <View>
            <Label>
              Key
              <Text color="danger" elementType="span">
                {" "}
                *
              </Text>
            </Label>
            <Input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., OPENAI_API_KEY"
            />
            <Text size="XS" color="text-700">
              The environment variable name that can be referenced in custom
              providers
            </Text>
          </View>
          <View>
            <Label>
              Value
              <Text color="danger" elementType="span">
                {" "}
                *
              </Text>
            </Label>
            <Flex direction="row" gap="size-100" alignItems="center">
              <Input
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter secret value"
                css={{ flex: 1 }}
              />
              <Button
                variant="default"
                onClick={() => setShowValue(!showValue)}
                aria-label={showValue ? "Hide value" : "Show value"}
              >
                <Icon
                  svg={
                    showValue ? <Icons.EyeOffOutline /> : <Icons.EyeOutline />
                  }
                />
              </Button>
            </Flex>
            <Text size="XS" color="text-700">
              The secret value will be encrypted and stored securely
            </Text>
          </View>
        </Flex>
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button variant="default" onPress={onClose} size="S">
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={handleCreate}
            size="S"
            isDisabled={isCommitting || !key.trim() || !value.trim()}
          >
            Create Secret
          </Button>
        </Flex>
      </View>
    </div>
  );
}

export function NewSecretButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Button
        variant="primary"
        onPress={handleOpen}
        size="S"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
      >
        New Secret
      </Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <NewSecretDialogContent onClose={handleClose} />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
