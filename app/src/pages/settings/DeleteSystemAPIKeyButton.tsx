import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { useNotifySuccess } from "@phoenix/contexts";

export function DeleteSystemAPIKeyButton({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifySuccess = useNotifySuccess();
  const [commit] = useMutation(graphql`
    mutation DeleteSystemAPIKeyButtonMutation($input: DeleteApiKeyInput!) {
      deleteSystemApiKey(input: $input) {
        __typename
        id
      }
    }
  `);
  const handleDelete = useCallback(() => {
    commit({
      variables: {
        input: {
          id,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "System key deleted",
          message: "The system key has been deleted and is no longer active.",
        });
        setDialog(null);
        onDeleted();
      },
    });
  }, [commit, id, notifySuccess, setDialog]);
  const onDelete = () => {
    setDialog(
      <Dialog title="Delete System Key">
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete this system key? This cannot be undone and will disable all services using this key.`}
          </Text>
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant="danger"
              onClick={() => {
                handleDelete();
                setDialog(null);
              }}
            >
              Delete Key
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  };
  return (
    <>
      <Button
        variant="danger"
        size="compact"
        icon={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete System Key"
        onClick={onDelete}
      />
      <DialogContainer
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
