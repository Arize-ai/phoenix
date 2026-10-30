import { type FormEvent, useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Popover,
  PopoverArrow,
  Text,
  TextField,
  View,
} from "@phoenix/components";

import type { ExperimentMetadataFilter } from "./experimentMetadataFilters";
import {
  parseMetadataFilterKey,
  parseMetadataFilterValue,
} from "./experimentMetadataFilters";

/**
 * A button that opens a form for adding a metadata filter to the experiments
 * table.
 */
export function ExperimentMetadataFilterButton({
  onAddFilter,
}: {
  onAddFilter: (filter: ExperimentMetadataFilter) => void;
}) {
  return (
    <DialogTrigger>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.ListFilter />} />}
        aria-label="Filter experiments by metadata"
      >
        Metadata
      </Button>
      <Popover placement="bottom end" style={{ width: "360px" }}>
        <PopoverArrow />
        <Dialog aria-label="Filter experiments by metadata">
          {({ close }) => (
            <ExperimentMetadataFilterForm
              onSubmit={(filter) => {
                onAddFilter(filter);
                close();
              }}
            />
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function ExperimentMetadataFilterForm({
  onSubmit,
}: {
  onSubmit: (filter: ExperimentMetadataFilter) => void;
}) {
  const [key, setKey] = useState("");
  const [valueText, setValueText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const path = parseMetadataFilterKey(key);
  const value = parseMetadataFilterValue(valueText);
  const isKeyInvalid = isSubmitted && path === null;
  const isValueInvalid = isSubmitted && value === null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    if (path !== null && value !== null) {
      onSubmit({ path, value });
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <TextField
            size="S"
            value={key}
            onChange={setKey}
            isInvalid={isKeyInvalid}
            autoFocus
          >
            <Label>Key</Label>
            <Input placeholder="model_params.temperature" />
            {isKeyInvalid ? (
              <FieldError>Enter a key, using dots for nested keys</FieldError>
            ) : (
              <Text slot="description">Use dots for nested keys</Text>
            )}
          </TextField>
          <TextField
            size="S"
            value={valueText}
            onChange={setValueText}
            isInvalid={isValueInvalid}
          >
            <Label>Value</Label>
            <Input placeholder="0.7" />
            {isValueInvalid ? (
              <FieldError>Enter a value</FieldError>
            ) : (
              <Text slot="description">
                Numbers and true or false match by type. Quote them to match
                text, as in &quot;0.7&quot;.
              </Text>
            )}
          </TextField>
          <Flex direction="row" justifyContent="end">
            <Button type="submit" variant="primary" size="S">
              Add filter
            </Button>
          </Flex>
        </Flex>
      </View>
    </Form>
  );
}
