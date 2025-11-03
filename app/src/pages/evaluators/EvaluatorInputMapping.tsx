import { PropsWithChildren, Suspense, useMemo, useState } from "react";
import { Control, Controller } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  ComboBox,
  ComboBoxItem,
  Icon,
  Icons,
  Loading,
  Text,
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
  const [inputValue, setInputValue] = useState("");
  // iterate over all keys in the control
  // each row should have a label, an arrow pointing to the example field, and a select field
  // the label should be the key, the select field should have all flattened example keys as options
  return (
    <Flex direction="column" gap="size-100" width="100%">
      {labels.map((label) => (
        <div
          key={label}
          css={css`
            display: grid;
            grid-template-columns: 4fr 1fr 4fr;
            gap: var(--ac-global-dimension-static-size-100);
            align-items: center;
            justify-items: center;
            width: 100%;
          `}
        >
          <Controller
            name={label}
            control={control}
            render={({ field }) => (
              <ComboBox
                aria-label={`Select an example field for ${label}`}
                placeholder="Select an example field"
                defaultItems={allExampleKeys}
                selectedKey={field.value ?? ""}
                onSelectionChange={(key) => {
                  // toggle existing value
                  if (key === field.value) {
                    field.onChange(null);
                    setInputValue("");
                    return;
                  }
                  // set new value
                  field.onChange(key);
                  setInputValue((key as string) ?? "");
                }}
                onInputChange={setInputValue}
                inputValue={inputValue}
                css={css`
                  width: 100%;
                `}
              >
                {(item) => (
                  <ComboBoxItem key={item.id} id={item.id} textValue={item.id}>
                    {item.label}
                  </ComboBoxItem>
                )}
              </ComboBox>
            )}
          />
          <Icon svg={<Icons.ArrowRightWithStem />} />
          <Text
            css={css`
              white-space: nowrap;
            `}
            title={label}
          >
            <Truncate maxWidth="200px">{label}</Truncate>
          </Text>
        </div>
      ))}
    </Flex>
  );
};
