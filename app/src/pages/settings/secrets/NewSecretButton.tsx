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
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { SecretMutationForm } from "./SecretMutationForm";
import { useSecretMutation } from "./SecretsMutation";

export function NewSecretButton({ connectionId }: { connectionId: string }) {
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
        size="S"
        variant="primary"
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        onPress={() => {
          setError(null);
          setIsOpen(true);
        }}
      >
        New Secret
      </Button>
      <ModalOverlay>
        <Modal size="M">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <SecretMutationForm
                submitLabel={isCommitting ? "Creating..." : "Create Secret"}
                isSubmitting={isCommitting}
                onSubmit={({ key, value }) => {
                  setError(null);
                  commit({
                    variables: {
                      input: {
                        secrets: [{ key: key.trim(), value: value.trim() }],
                      },
                      connections: [connectionId],
                    },
                    onCompleted: () => {
                      setIsOpen(false);
                      notifySuccess({
                        title: "Secret created",
                        message: `${key.trim()} is now stored on the server.`,
                      });
                    },
                    onError: (error) => {
                      const formattedError =
                        getErrorMessagesFromRelayMutationError(error);
                      setError(formattedError?.[0] ?? error.message);
                    },
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
