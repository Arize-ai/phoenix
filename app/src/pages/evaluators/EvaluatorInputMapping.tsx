import { PropsWithChildren, Suspense, useMemo } from "react";
import { Control, Controller } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  Icon,
  Icons,
  Input,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  SearchField,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
  useFilter,
  View,
} from "@phoenix/components";
import { Heading } from "@phoenix/components/content/Heading";
import { Flex } from "@phoenix/components/layout/Flex";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { EvaluatorInputMappingControlsQuery } from "@phoenix/pages/evaluators/__generated__/EvaluatorInputMappingControlsQuery.graphql";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import { flattenObject } from "@phoenix/utils/jsonUtils";

export type InputMapping = Record<string, string>;

type EvaluatorInputMappingProps = {
  control: Control<InputMapping, unknown, InputMapping>;
  exampleId?: string;
};

export const EvaluatorInputMapping = ({
  control,
  exampleId,
}: EvaluatorInputMappingProps) => {
  if (!exampleId) {
    return (
      <EvaluatorInputMappingTitle>
        <Text color="text-500">
          Select a dataset example to view available fields.
        </Text>
      </EvaluatorInputMappingTitle>
    );
  }
  return (
    <EvaluatorInputMappingTitle>
      <Suspense fallback={<Loading />}>
        <EvaluatorInputMappingControls
          exampleId={exampleId}
          control={control}
        />
      </Suspense>
    </EvaluatorInputMappingTitle>
  );
};

const EvaluatorInputMappingTitle = ({ children }: PropsWithChildren) => {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={3}>Mapping</Heading>
      <Text color="text-500">
        Map the evaluator input fields to the example input fields.
      </Text>
      {children}
    </Flex>
  );
};

type ExampleKeyItem = {
  id: string;
  label: string;
  section: "Input" | "Reference Output" | "Metadata";
};

const EvaluatorInputMappingControls = ({
  exampleId,
  control,
}: {
  exampleId: string;
  control: Control<InputMapping, unknown, InputMapping>;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances[0];
  invariant(
    instance,
    "There should be one instance available on the New Evaluator page"
  );
  const data = useLazyLoadQuery<EvaluatorInputMappingControlsQuery>(
    graphql`
      query EvaluatorInputMappingControlsQuery($exampleId: ID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            revision {
              input
              output: output
              metadata
            }
          }
        }
      }
    `,
    { exampleId }
  );
  const allExampleKeys: ExampleKeyItem[] = useMemo(() => {
    if (!data.example?.revision) {
      return [];
    }
    const flat = flattenObject({
      obj: data.example.revision,
      keepNonTerminalValues: true,
    });
    return [
      ...Object.keys(flat).map((key) => ({
        id: key,
        label: key,
        section: key.startsWith("input.")
          ? ("Input" as const)
          : key.startsWith("output.")
            ? ("Reference Output" as const)
            : ("Metadata" as const),
      })),
    ];
  }, [data]);
  const { variableKeys: labels } = useDerivedPlaygroundVariables();
  // iterate over all keys in the control
  // each row should have a label, an arrow pointing to the example field, and a select field
  // the label should be the key, the select field should have all flattened example keys as options
  return (
    <Flex direction="column" gap="size-100">
      {labels.map((label) => (
        <Flex direction="row" gap="size-100" alignItems="center" key={label}>
          <Text
            css={css`
              white-space: nowrap;
              min-width: 200px;
            `}
            title={label}
          >
            <Truncate maxWidth="200px">{label}</Truncate>
          </Text>
          <Icon svg={<Icons.ArrowRight />} />
          <Controller
            name={label}
            control={control}
            render={({ field }) => (
              <Select
                placeholder="Select an example field"
                value={field.value}
                onChange={field.onChange}
                css={css`
                  width: 100%;
                `}
              >
                <Button>
                  <SelectValue />
                  <SelectChevronUpDownIcon />
                </Button>
                <Popover>
                  <Autocomplete filter={contains}>
                    <View paddingX="size-100" marginTop="size-100">
                      <SearchField aria-label="Search" autoFocus>
                        <Input placeholder="Search example fields" />
                      </SearchField>
                    </View>
                    <ListBox items={allExampleKeys}>
                      {(item) => (
                        <ListBoxItem
                          key={item.id}
                          id={item.id}
                          textValue={item.id}
                        >
                          {item.label}
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Autocomplete>
                </Popover>
              </Select>
            )}
          />
        </Flex>
      ))}
    </Flex>
  );
};
