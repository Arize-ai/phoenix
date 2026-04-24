import { Suspense, useCallback, useState } from "react";
import type { PreloadedQuery } from "react-relay";
import { graphql, usePreloadedQuery, useQueryLoader } from "react-relay";

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
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { ReplaceSecretButtonQuery } from "./__generated__/ReplaceSecretButtonQuery.graphql";
import { SecretMutationForm } from "./SecretMutationForm";
import { useSecretMutation } from "./SecretsMutation";

const ReplaceSecretQuery = graphql`
  query ReplaceSecretButtonQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on Secret {
        id
        key
        value {
          __typename
          ... on DecryptedSecret {
            value
          }
          ... on UnparsableSecret {
            parseError
          }
        }
      }
    }
  }
`;

function ReplaceSecretDialogContent({
  queryReference,
  secretKey,
  isCommitting,
  onSubmit,
}: {
  queryReference: PreloadedQuery<ReplaceSecretButtonQuery>;
  secretKey: string;
  isCommitting: boolean;
  onSubmit: (value: string) => void;
}) {
  const data = usePreloadedQuery<ReplaceSecretButtonQuery>(
    ReplaceSecretQuery,
    queryReference
  );

  const node = data.node;
  if (!node || node.__typename !== "Secret") {
    return <Alert variant="danger">Secret not found</Alert>;
  }

  const resolvedValue = node.value;
  const parseError =
    resolvedValue?.__typename === "UnparsableSecret"
      ? resolvedValue.parseError
      : null;
  const redactedValue =
    resolvedValue?.__typename === "DecryptedSecret" ? resolvedValue.value : "";

  return (
    <>
      {parseError && (
        <Alert variant="warning">
          The stored secret could not be decrypted. Enter a new value below.
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
        onSubmit={({ value }) => onSubmit(value)}
      />
    </>
  );
}

export function ReplaceSecretButton({
  secretId,
  secretKey,
  connectionId,
}: {
  secretId: string;
  secretKey: string;
  connectionId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useSecretMutation();
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<ReplaceSecretButtonQuery>(ReplaceSecretQuery);

  const handleOpen = useCallback(() => {
    setError(null);
    loadQuery({ id: secretId }, { fetchPolicy: "network-only" });
    setIsOpen(true);
  }, [loadQuery, secretId]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    disposeQuery();
  }, [disposeQuery]);

  const handleSubmit = useCallback(
    (value: string) => {
      setError(null);
      commit({
        variables: {
          input: {
            secrets: [{ key: secretKey, value: value.trim() }],
          },
          connections: [connectionId],
        },
        onCompleted: () => {
          handleClose();
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
    [commit, connectionId, handleClose, notifySuccess, secretKey]
  );

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
        aria-label={`Replace ${secretKey}`}
        size="S"
        onPress={handleOpen}
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
              <Suspense fallback={<Loading />}>
                {queryReference ? (
                  <ReplaceSecretDialogContent
                    queryReference={queryReference}
                    secretKey={secretKey}
                    isCommitting={isCommitting}
                    onSubmit={handleSubmit}
                  />
                ) : (
                  <Loading />
                )}
              </Suspense>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
