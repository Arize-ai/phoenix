import { useCallback, useState } from "react";
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
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { UpsertSecretButtonMutation } from "./__generated__/UpsertSecretButtonMutation.graphql";

function UpsertSecretDialogContent({
  secretKey,
  currentValue,
  onClose,
}: {
  secretKey: string;
  currentValue: string | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(currentValue || "");
  const [showValue, setShowValue] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [commit, isCommitting] = useMutation<UpsertSecretButtonMutation>(
    graphql`
      mutation UpsertSecretButtonMutation($input: UpsertSecretMutationInput!) {
        upsertSecret(input: $input) {
          secret {
            id
            key
            value
          }
          query {
            ...SecretsCard_data
          }
        }
      }
    `
  );

  const handleUpdate = useCallback(() => {
    if (!value.trim()) {
      notifyError({
        title: "Invalid input",
        message: "Value cannot be empty",
      });
      return;
    }

    commit({
      variables: {
        input: {
          key: secretKey,
          value: value.trim(),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Secret updated",
          message: `Secret "${secretKey}" has been updated successfully.`,
        });
        onClose();
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update secret",
          message: messages?.join(", ") || "An unknown error occurred",
        });
      },
    });
  }, [commit, secretKey, value, notifyError, notifySuccess, onClose]);

  return (
    <div>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <View>
            <Label>Key</Label>
            <Input type="text" value={secretKey} disabled />
            <Text size="XS" color="text-700">
              The secret key cannot be changed
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
                autoFocus
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
            {currentValue === null ? (
              <Text size="XS" color="danger">
                ⚠️ Current value could not be decrypted. Enter a new value to
                replace it.
              </Text>
            ) : (
              <Text size="XS" color="text-700">
                Edit the secret value. It will be encrypted and stored securely.
              </Text>
            )}
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
            onPress={handleUpdate}
            size="S"
            isDisabled={isCommitting || !value.trim()}
          >
            Update Secret
          </Button>
        </Flex>
      </View>
    </div>
  );
}

export function UpsertSecretButton({
  secretKey,
  currentValue,
}: {
  secretKey: string;
  currentValue: string | null;
}) {
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
        variant="default"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label="Edit secret"
        onPress={handleOpen}
        size="S"
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <UpsertSecretDialogContent
                secretKey={secretKey}
                currentValue={currentValue}
                onClose={handleClose}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
