import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";

import { Button } from "@phoenix/components/button";
import { DatasetExampleSelect_ExampleSelectPopoverContentQuery } from "@phoenix/components/dataset/__generated__/DatasetExampleSelect_ExampleSelectPopoverContentQuery.graphql";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { ListBox } from "@phoenix/components/listbox";
import { Popover } from "@phoenix/components/overlay";
import { Select, SelectItem, SelectValue } from "@phoenix/components/select";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { IdTruncate } from "@phoenix/pages/playground/PromptMenu";

export type DatasetExampleSelectProps = {
  datasetId: string | null;
  selectedExampleId: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
};

export const DatasetExampleSelect = (props: DatasetExampleSelectProps) => {
  const { selectedExampleId, onSelectExampleId } = props;
  return (
    <Select
      selectionMode="single"
      value={selectedExampleId}
      onChange={(value) => onSelectExampleId(value as string | null)}
      aria-label="Select an example"
      placeholder="Select an example"
      minWidth="0"
    >
      <Button trailingVisual={<SelectChevronUpDownIcon />} size="S">
        <Truncate maxWidth="100%">
          <SelectValue />
        </Truncate>
      </Button>
      <Popover>
        <Suspense>
          <ExampleSelectPopoverContent {...props} />
        </Suspense>
      </Popover>
    </Select>
  );
};

const ExampleSelectPopoverContent = ({
  datasetId,
  selectedExampleId,
}: DatasetExampleSelectProps) => {
  const data =
    useLazyLoadQuery<DatasetExampleSelect_ExampleSelectPopoverContentQuery>(
      graphql`
        query DatasetExampleSelect_ExampleSelectPopoverContentQuery(
          $datasetId: ID!
          $hasDataset: Boolean!
        ) {
          dataset: node(id: $datasetId) @include(if: $hasDataset) {
            ... on Dataset {
              examples(first: 10) {
                edges {
                  example: node {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      { datasetId: datasetId ?? "", hasDataset: datasetId != null }
    );
  const selectedExample = useMemo(
    () => (selectedExampleId ? [selectedExampleId] : []),
    [selectedExampleId]
  );
  const examples = data.dataset?.examples?.edges.map((edge) => edge.example);
  return (
    <ListBox items={examples} selectedKeys={selectedExample}>
      {(item) => (
        <SelectItem key={item.id} id={item.id}>
          <IdTruncate ellipsis id={item.id} />
        </SelectItem>
      )}
    </ListBox>
  );
};
