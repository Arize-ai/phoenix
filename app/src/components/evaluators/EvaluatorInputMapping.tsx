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
import {
  datasetExampleToEvaluatorInput,
  EMPTY_EVALUATOR_INPUT,
  EvaluatorInput,
} from "@phoenix/components/evaluators/utils";
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
      <Heading level={3}>Map fields</Heading>
      <Text color="text-500">
        Your evaluator requires certain fields to be available in its input. Map
        these fields to those available in its context.
      </Text>
      {children}
    </Flex>
  );
};

type ExampleKeyItem = {
  id: string;
  label: string;
};

const EvaluatorInputMappingControls = ({
  exampleId,
  control,
  variables,
}: {
  exampleId?: string;
  control: Control<EvaluatorFormValues, unknown, EvaluatorFormValues>;
  variables: string[];
}) => {
  const data = useLazyLoadQuery<EvaluatorInputMappingControlsQuery>(
    graphql`
      query EvaluatorInputMappingControlsQuery(
        $exampleId: ID!
        $hasExample: Boolean!
      ) {
        example: node(id: $exampleId) @include(if: $hasExample) {
          ... on DatasetExample {
            revision {
              ...utils_datasetExampleToEvaluatorInput_example
            }
          }
        }
      }
    `,
    { exampleId: exampleId ?? "", hasExample: exampleId != null }
  );
  const example = data.example;
  const evaluatorInput: EvaluatorInput = useMemo(() => {
    if (!example?.revision) {
      return EMPTY_EVALUATOR_INPUT;
    }
    try {
      const evaluatorInput = datasetExampleToEvaluatorInput({
        exampleRef: example.revision,
      });
      return evaluatorInput;
    } catch {
      return EMPTY_EVALUATOR_INPUT;
    }
  }, [example]);
  const allExampleKeys: ExampleKeyItem[] = useMemo(() => {
    const flat = flattenObject({
      obj: evaluatorInput,
      keepNonTerminalValues: true,
    });
    return [
      ...Object.keys(flat).map((key) => ({
        id: key,
        label: key,
      })),
    ];
  }, [evaluatorInput]);
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
                  min-width: 0 !important;
                  // allow the combobox to shrink to prevent blowing up page layout
                  .px-combobox-container {
                    min-width: 0 !important;
                    input {
                      min-width: 0 !important;
                    }
                  }
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
