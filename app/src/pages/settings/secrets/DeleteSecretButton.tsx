import { useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
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
  Flex,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { useSecretMutation } from "./SecretsMutation";

export function DeleteSecretButton({
  secretKey,
  onComplete,
}: {
  secretKey: string;
  onComplete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useSecretMutation();

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setError(null);
        setIsOpen(open);
      }}
    >
      <Button
        variant="danger"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label={`Delete ${secretKey}`}
        size="S"
        onPress={() => {
          setError(null);
          setIsOpen(true);
        }}
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <View padding="size-200">
                <Text color="danger">
                  Delete <strong>{secretKey}</strong>? This removes the stored
                  server secret and cannot be undone.
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button
                    variant="default"
                    size="S"
                    onPress={() => setIsOpen(false)}
                    isDisabled={isCommitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={() => {
                      setError(null);
                      commit({
                        variables: {
                          input: {
                            secrets: [{ key: secretKey, value: null }],
                          },
                        },
                        onCompleted: () => {
                          setIsOpen(false);
                          onComplete();
                          notifySuccess({
                            title: "Secret deleted",
                            message: `${secretKey} has been removed.`,
                          });
                        },
                        onError: (error) => {
                          const formattedError =
                            getErrorMessagesFromRelayMutationError(error);
                          setError(formattedError?.[0] ?? error.message);
                        },
                      });
                    }}
                    isDisabled={isCommitting}
                  >
                    {isCommitting ? "Deleting..." : "Delete Secret"}
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
