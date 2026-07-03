import type { Completion } from "@codemirror/autocomplete";
import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

import { Flex, Text, View } from "@phoenix/components";
import type { DSLFilterSnippet } from "@phoenix/components/filter";
import {
  DSLFilterConditionBuilder,
  DSLFilterConditionField,
  type DSLFilterConditionFieldProps,
} from "@phoenix/components/filter";

/**
 * An example DSL vocabulary: variables the expression can reference plus
 * "macro" snippets that expand to full conditions.
 */
const completions: Completion[] = [
  {
    label: "name",
    type: "variable",
    info: "The name of the record",
  },
  {
    label: "latency_ms",
    type: "variable",
    info: "Latency (i.e. duration) in milliseconds",
  },
  {
    label: "metadata",
    type: "variable",
    info: "The metadata of the record",
  },
  {
    label: "Latency >= 10s",
    type: "text",
    apply: "latency_ms >= 10_000",
    detail: "macro",
  },
  {
    label: "Metadata",
    type: "text",
    apply: "metadata['topic'] == 'agent'",
    detail: "macro",
  },
];

const snippets: DSLFilterSnippet[] = [
  {
    key: "latency",
    label: "filter by latency",
    snippet: "latency_ms >= 10_000",
  },
  {
    key: "metadata",
    label: "filter by metadata",
    snippet: "metadata['topic'] == 'agent'",
  },
  {
    key: "substring",
    label: "filter by substring",
    snippet: "'agent' in name",
  },
];

/**
 * A fake async validator: rejects expressions containing "invalid" so the
 * error state can be exercised.
 */
async function validateCondition(condition: string) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (condition.includes("invalid")) {
    return {
      isValid: false,
      errorMessage: "The expression could not be parsed",
    };
  }
  return { isValid: true, errorMessage: null };
}

const meta: Meta<typeof DSLFilterConditionField> = {
  title: "Filter/DSLFilterConditionField",
  component: DSLFilterConditionField,
  parameters: {
    controls: { expanded: true },
  },
  args: {
    onValidCondition: fn(),
    onValidationStateChange: fn(),
  },
};

export default meta;

const Template: StoryFn<DSLFilterConditionFieldProps> = (args) => {
  const [value, setValue] = useState<string>("");
  const [validCondition, setValidCondition] = useState<string>("");
  const appendCondition = (condition: string) =>
    setValue(value ? `${value} and ${condition}` : condition);
  return (
    <View width="600px">
      <Flex direction="column" gap="size-100">
        <DSLFilterConditionField
          {...args}
          value={value}
          onChange={setValue}
          completions={completions}
          validateCondition={validateCondition}
          onValidCondition={(condition) => {
            setValidCondition(condition);
            args.onValidCondition(condition);
          }}
          builder={
            <DSLFilterConditionBuilder
              snippets={snippets}
              onAddCondition={appendCondition}
            />
          }
        />
        <Text color="text-700" size="XS">
          {validCondition
            ? `Applied condition: ${validCondition}`
            : "No condition applied"}
        </Text>
      </Flex>
    </View>
  );
};

/**
 * Type to see the DSL vocabulary via typeahead. Conditions containing the
 * word "invalid" fail validation to demonstrate the error state.
 */
export const Default = {
  render: Template,
};

/**
 * Without a `builder`, the "+" snippet-builder trigger is omitted.
 */
export const WithoutBuilder: StoryFn<DSLFilterConditionFieldProps> = (args) => {
  const [value, setValue] = useState<string>("");
  return (
    <View width="600px">
      <DSLFilterConditionField
        {...args}
        value={value}
        onChange={setValue}
        placeholder="filter condition (e.x. latency_ms >= 10_000)"
        completions={completions}
        validateCondition={validateCondition}
      />
    </View>
  );
};
