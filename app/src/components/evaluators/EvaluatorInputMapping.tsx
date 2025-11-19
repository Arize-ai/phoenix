import {
  PropsWithChildren,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Control, Controller } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";
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
import { EvaluatorInputMappingControlsQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorInputMappingControlsQuery.graphql";
import { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { Flex } from "@phoenix/components/layout/Flex";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { flattenObject } from "@phoenix/utils/jsonUtils";

export type InputMapping = Record<string, string>;

type EvaluatorInputMappingProps = {
  control: Control<EvaluatorFormValues, unknown, EvaluatorFormValues>;
  exampleId?: string;
  variables: string[];
};

export const EvaluatorInputMapping = ({
  control,
  exampleId,
  variables,
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
          variables={variables}
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
  variables,
}: {
  exampleId: string;
  control: Control<EvaluatorFormValues, unknown, EvaluatorFormValues>;
  variables: string[];
}) => {
  const data = useLazyLoadQuery<EvaluatorInputMappingControlsQuery>(
    graphql`
      query EvaluatorInputMappingControlsQuery($exampleId: ID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            revision {
              input
              output
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
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const setInputValue = useCallback((key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  }, []);
  // iterate over all keys in the control
  // each row should have a variable, an arrow pointing to the example field, and a select field
  // the variable should be the key, the select field should have all flattened example keys as options
  return (
    <Flex direction="column" gap="size-100" width="100%">
      {variables.map((variable) => (
        <div
          key={variable}
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
            name={`inputMapping.${variable}`}
            control={control}
            render={({ field }) => (
              <ComboBox
                aria-label={`Select an example field for ${variable}`}
                placeholder="Select an example field"
                defaultItems={allExampleKeys}
                selectedKey={field.value ?? ""}
                onSelectionChange={(key) => {
                  field.onChange(key);
                  setInputValue(variable, key as string);
                }}
                onInputChange={(value) => setInputValue(variable, value)}
                inputValue={inputValues[variable] ?? ""}
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
            title={variable}
          >
            <Truncate maxWidth="200px">{variable}</Truncate>
          </Text>
        </div>
      ))}
    </Flex>
  );
};
