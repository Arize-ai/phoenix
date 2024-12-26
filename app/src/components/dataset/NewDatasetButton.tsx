import React, { useState } from "react";

import { Alert, Card, PopoverTrigger, View } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

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
      <Button
        variant="default"
        icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        aria-label="Create a new dataset"
      />
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
            onDatasetCreateError={(error) => setError(error.message)}
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
