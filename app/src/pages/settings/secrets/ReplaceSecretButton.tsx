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
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { SecretMutationForm } from "./SecretMutationForm";
import { useSecretMutation } from "./SecretsMutation";

export function ReplaceSecretButton({
  secretKey,
  parseError,
  connectionId,
}: {
  secretKey: string;
  /** Decrypt error from the server, when the stored secret is unparseable. */
  parseError: string | null;
  connectionId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useSecretMutation();

  const handleSubmit = ({ value }: { value: string }) => {
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
  };

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
        leadingVisual={<Icon svg={<Icons.Edit />} />}
        aria-label={`Replace ${secretKey}`}
        size="S"
      />
      <ViewportModalOverlay>
        <ViewportModal size="M">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Replace Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {error ? (
                <Alert variant="danger" banner>
                  {error}
                </Alert>
              ) : null}
              {parseError && (
                <Alert variant="warning" banner>
                  Could not decrypt the stored value.
                </Alert>
              )}
              <SecretMutationForm
                title="Enter a new value to replace the stored secret."
                fixedKey={secretKey}
                defaultKey={secretKey}
                submitLabel={isCommitting ? "Saving..." : "Save Secret"}
                isSubmitting={isCommitting}
                onSubmit={handleSubmit}
              />
            </DialogContent>
          </Dialog>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
