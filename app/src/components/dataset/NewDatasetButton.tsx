import { useState } from "react";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { CreateDatasetForm } from "./CreateDatasetForm";

export function NewDatasetButton({
  onDatasetCreated,
}: {
  onDatasetCreated?: (datasetId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(isOpen) => {
        setError(null);
        setIsOpen(isOpen);
      }}
    >
      <Button
        variant="primary"
        size="M"
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        aria-label="Create a new dataset"
        onPress={() => {
          setError(null);
          setIsOpen(true);
        }}
      />
      <Popover
        placement="bottom right"
        css={css`
          border: none;
        `}
      >
        <Card
          title="Create New Dataset"
          borderColor="light"
          backgroundColor="light"
        >
          <View width="500px">
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <CreateDatasetForm
              onDatasetCreateError={(error) => {
                const formattedError =
                  getErrorMessagesFromRelayMutationError(error);
                setError(formattedError?.[0] ?? error.message);
              }}
              onDatasetCreated={({ id, name }) => {
                setError(null);
                setIsOpen(false);
                if (onDatasetCreated) {
                  onDatasetCreated(id);
                }
                notifySuccess({
                  title: `Dataset Created`,
                  message: `Dataset "${name}" created successfully`,
                });
              }}
            />
          </View>
        </Card>
      </Popover>
    </DialogTrigger>
  );
}
