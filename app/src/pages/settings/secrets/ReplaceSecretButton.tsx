import { useCallback, useState } from "react";

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
  redactedValue,
  parseError,
  connectionId,
}: {
  secretKey: string;
  /** Server-issued redacted token for the stored secret. Empty for unparseable. */
  redactedValue: string;
  /** Decrypt error from the server, when the stored secret is unparseable. */
  parseError: string | null;
  connectionId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useSecretMutation();

  const handleSubmit = useCallback(
    ({ value }: { value: string }) => {
      setError(null);
      commit({
        variables: {
          input: {
            secrets: [{ key: secretKey, value: value.trim() }],
          },
          connections: [connectionId],
        },
        onCompleted: () => {
          setIsOpen(false);
          notifySuccess({
            title: "Secret updated",
            message: `${secretKey} has been replaced.`,
          });
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, connectionId, notifySuccess, secretKey]
  );

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
              {parseError && (
                <Alert variant="warning">
                  The stored secret could not be decrypted. Enter a new value
                  below.
                  <div style={{ marginTop: 8, fontSize: "0.875em" }}>
                    Error: {parseError}
                  </div>
                </Alert>
              )}
              <SecretMutationForm
                title="Enter a new value to replace the stored secret."
                fixedKey={secretKey}
                defaultKey={secretKey}
                defaultValue={redactedValue}
                submitLabel={isCommitting ? "Saving..." : "Save Secret"}
                isSubmitting={isCommitting}
                onSubmit={handleSubmit}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
