import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Button, Flex, Label, Text } from "@phoenix/components";
import { EvaluatorExampleSelectQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorExampleSelectQuery.graphql";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { ListBox } from "@phoenix/components/listbox";
import { Popover } from "@phoenix/components/overlay";
import { Select, SelectItem, SelectValue } from "@phoenix/components/select";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { IdTruncate } from "@phoenix/pages/playground/PromptMenu";

export type EvaluatorExampleSelectProps = {
  datasetId: string | null;
  selectedExampleId: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
};

/**
 * A select component for choosing dataset examples.
 * Displays a truncated JSON snippet of each example instead of just the ID.
 */
export const EvaluatorExampleSelect = (props: EvaluatorExampleSelectProps) => {
  const { selectedExampleId, onSelectExampleId } = props;
  return (
    <Select
      selectionMode="single"
      value={selectedExampleId}
      onChange={(value) => onSelectExampleId(value as string | null)}
      aria-label="Select an example"
      placeholder="Select an example"
    >
      <Label>Example</Label>
      <Button
        trailingVisual={<SelectChevronUpDownIcon />}
        size="S"
        css={css`
          width: 100%;
        `}
      >
        <Truncate maxWidth="100%">
          <SelectValue />
        </Truncate>
      </Button>
      <Popover
        css={css`
          width: var(--trigger-width);
        `}
      >
        <Suspense>
          <EvaluatorExampleSelectContent {...props} />
        </Suspense>
      </Popover>
    </Select>
  );
};

type ExampleItem = {
  id: string;
  snippet: string;
};

const EvaluatorExampleSelectContent = ({
  datasetId,
  selectedExampleId,
}: EvaluatorExampleSelectProps) => {
  const data = useLazyLoadQuery<EvaluatorExampleSelectQuery>(
    graphql`
      query EvaluatorExampleSelectQuery(
        $datasetId: ID!
        $hasDataset: Boolean!
      ) {
        dataset: node(id: $datasetId) @include(if: $hasDataset) {
          ... on Dataset {
            examples(first: 20) {
              edges {
                example: node {
                  id
                  revision {
                    input
                    output
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId: datasetId ?? "", hasDataset: datasetId != null }
  );

  const examples: ExampleItem[] = useMemo(() => {
    if (!data.dataset?.examples?.edges) {
      return [];
    }
    return data.dataset.examples.edges.map((edge) => {
      const example = edge.example;
      // Create a compact JSON representation combining input and output
      const combined = {
        input: example.revision?.input,
        output: example.revision?.output,
      };
      const snippet = JSON.stringify(combined);
      return {
        id: example.id,
        snippet,
      };
    });
  }, [data]);

  const selectedKeys = useMemo(
    () => (selectedExampleId ? [selectedExampleId] : []),
    [selectedExampleId]
  );

  return (
    <ListBox items={examples} selectedKeys={selectedKeys}>
      {(item) => (
        <SelectItem key={item.id} id={item.id} textValue={item.snippet}>
          <Flex gap="size-100">
            <IdTruncate id={item.id} />
            <Text color="text-500" size="S" fontFamily="mono">
              <Truncate maxWidth="100%">{item.snippet}</Truncate>
            </Text>
          </Flex>
        </SelectItem>
      )}
    </ListBox>
  );
};
