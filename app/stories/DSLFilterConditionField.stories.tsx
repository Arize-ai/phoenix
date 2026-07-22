import type { Completion } from "@codemirror/autocomplete";
import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

import { Flex, Text, View } from "@phoenix/components";
import type { DSLFilterSnippet } from "@phoenix/components/filter";
import {
  createAnnotationMemberCompletions,
  DSLFilterConditionField,
  type DSLFilterConditionFieldProps,
} from "@phoenix/components/filter";

/**
 * An example DSL vocabulary: the fields an expression can reference
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
];

/**
 * Example conditions surfaced in the typeahead as suggestions — including
 * when the empty field is focused. `${placeholder}` segments become
 * tab-through fields on insert. More snippets than the browse cap, so the
 * story demonstrates that only the first few show when the empty field is
 * focused while the rest (e.g. "filter by name prefix") surface as you type.
 */
const snippets: DSLFilterSnippet[] = [
  {
    label: "filter by latency",
    snippet: "latency_ms >= ${10_000}",
  },
  {
    label: "filter by metadata",
    snippet: "metadata['${key}'] == '${value}'",
  },
  {
    label: "filter by substring",
    snippet: "'${search text}' in name",
  },
  {
    label: "filter by name",
    snippet: "name == '${name}'",
  },
  {
    label: "filter by fast responses",
    snippet: "latency_ms < ${1_000}",
  },
  {
    label: "filter by name prefix",
    snippet: "name.startswith('${prefix}')",
  },
];

/**
 * Simulates fetching completions for values that actually exist in the
 * user's data (e.g. annotation names)
 */
async function loadCompletions(): Promise<Completion[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return createAnnotationMemberCompletions({
    accessor: "annotations",
    noun: "annotation",
    sectionName: "Annotations",
    names: ["Hallucination", "Toxicity"],
  });
}

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
  return (
    <View width="600px">
      <Flex direction="column" gap="size-100">
        <DSLFilterConditionField
          {...args}
          value={value}
          onChange={setValue}
          completions={completions}
          snippets={snippets}
          loadCompletions={loadCompletions}
          validateCondition={validateCondition}
          onValidCondition={(condition, result) => {
            setValidCondition(condition);
            args.onValidCondition(condition, result);
          }}
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
 * Focus the empty field to see suggested conditions and fields; type to
 * filter them. Suggestions insert with tab-through placeholders. Conditions
 * containing the word "invalid" fail validation to demonstrate the error
 * state.
 */
export const Default = {
  render: Template,
};

/**
 * Without `snippets` or `loadCompletions`, the typeahead surfaces only the
 * static field vocabulary.
 */
export const FieldsOnly: StoryFn<DSLFilterConditionFieldProps> = (args) => {
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
