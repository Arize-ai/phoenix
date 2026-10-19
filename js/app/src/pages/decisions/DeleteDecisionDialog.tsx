import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

import type { DeleteDecisionDialogMutation } from "./__generated__/DeleteDecisionDialogMutation.graphql";

export function DeleteDecisionDialog({
  decisionId,
  onDeleted,
}: {
  decisionId: string;
  onDeleted: () => void;
}) {
  const [commit, isCommitting] = useMutation<DeleteDecisionDialogMutation>(
    graphql`
      mutation DeleteDecisionDialogMutation($decisionId: ID!) {
        deleteDecision(input: { decisionId: $decisionId }) {
          query {
            ...DecisionsTable_decisions
          }
        }
      }
    `
  );

  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(() => {
    commit({
      variables: {
        decisionId,
      },
      onCompleted: (_, errors) => {
        if (errors?.length) {
          setError(errors.map((error) => error.message).join("\n"));
          return;
        }
        notifySuccess({
          title: "Delete Successful",
          message: "Decision has been deleted.",
        });
        onDeleted();
      },
      onError: (error) => {
        setError(error.message);
      },
    });
  }, [commit, notifySuccess, onDeleted, decisionId]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Decision</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        {error && (
          <View paddingX="size-200" paddingTop="size-100">
            <Alert variant="danger">{error}</Alert>
          </View>
        )}
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete this decision? This action cannot be undone and all services dependent on this decision will be affected.`}
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
            <Button variant="default" slot="close" size="S">
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                handleDelete();
              }}
              size="S"
              isDisabled={isCommitting}
            >
              Delete Decision
            </Button>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
