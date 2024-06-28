import React, { startTransition, useState } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import {
  Alert,
  Button,
  Card,
  Flex,
  Icon,
  Icons,
  Item,
  Picker,
  PickerProps,
  PopoverTrigger,
  View,
} from "@arizeai/components";

import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { useNotifySuccess } from "@phoenix/contexts";

import { DatasetPicker__datasets$key } from "./__generated__/DatasetPicker__datasets.graphql";
import { DatasetPickerRefetchQuery } from "./__generated__/DatasetPickerRefetchQuery.graphql";

export function DatasetPicker(
  props: Pick<
    PickerProps<string>,
    "onSelectionChange" | "onBlur" | "validationState" | "errorMessage"
  > & { query: DatasetPicker__datasets$key }
) {
  const [data, refetch] = useRefetchableFragment<
    DatasetPickerRefetchQuery,
    DatasetPicker__datasets$key
  >(
    graphql`
      fragment DatasetPicker__datasets on Query
      @refetchable(queryName: "DatasetPickerRefetchQuery") {
        datasets {
          edges {
            dataset: node {
              id
              name
            }
          }
        }
      }
    `,
    props.query
  );
  return (
    <Flex direction="row" gap="size-100" alignItems="end">
      <Picker
        label="dataset"
        data-testid="dataset-picker"
        className="dataset-picker"
        width="100%"
        aria-label={`The dataset to add the example to`}
        onSelectionChange={props.onSelectionChange}
        placeholder="Select a dataset"
        onBlur={props.onBlur}
        isRequired
        validationState={props.validationState}
        errorMessage={props.errorMessage}
      >
        {data.datasets.edges.map(({ dataset }) => (
          <Item key={dataset.id}>{dataset.name}</Item>
        ))}
      </Picker>
      <NewDatasetButton
        onDatasetCreated={() => {
          startTransition(() => {
            // Refetch the datasets
            refetch(
              {},
              {
                fetchPolicy: "store-and-network",
              }
            );
          });
        }}
      />
    </Flex>
  );
}

function NewDatasetButton({
  onDatasetCreated,
}: {
  onDatasetCreated: (datasetId: string) => void;
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
              onDatasetCreated(id);
            }}
          />
        </View>
      </Card>
    </PopoverTrigger>
  );
}
