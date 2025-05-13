import { useState } from "react";

import { Card, PopoverTrigger, TriggerWrap } from "@arizeai/components";

import { Alert, Button, Icon, Icons, View } from "@phoenix/components";
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
    <PopoverTrigger
      placement="bottom right"
      isOpen={isOpen}
      onOpenChange={(isOpen) => {
        setError(null);
        setIsOpen(isOpen);
      }}
    >
      <TriggerWrap>
        <Button
          variant="default"
          leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
          aria-label="Create a new dataset"
          onPress={() => {
            setError(null);
            setIsOpen(true);
          }}
        />
      </TriggerWrap>
      <Card
        title="Create New Dataset"
        bodyStyle={{ padding: 0 }}
        variant="compact"
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
              notifySuccess({
                title: `Dataset Created`,
                message: `Dataset "${name}" created successfully`,
              });
              onDatasetCreated && onDatasetCreated(id);
            }}
          />
        </View>
      </Card>
    </PopoverTrigger>
  );
}
