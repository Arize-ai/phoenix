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

export function ReplaceSecretButton({
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
        variant="default"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label={`Replace ${secretKey}`}
        size="S"
        onPress={() => {
          setError(null);
          setIsOpen(true);
        }}
      />
      <ModalOverlay>
        <Modal size="M">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Replace Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <SecretMutationForm
                title="Enter a new value to replace the stored secret."
                fixedKey={secretKey}
                defaultKey={secretKey}
                submitLabel={isCommitting ? "Saving..." : "Save Secret"}
                isSubmitting={isCommitting}
                onSubmit={({ value }) => {
                  setError(null);
                  commit({
                    variables: {
                      input: {
                        secrets: [{ key: secretKey, value: value.trim() }],
                      },
                    },
                    onCompleted: () => {
                      setIsOpen(false);
                      onComplete();
                      notifySuccess({
                        title: "Secret updated",
                        message: `${secretKey} has been replaced.`,
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
