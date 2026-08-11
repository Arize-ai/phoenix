import type { Completion } from "@codemirror/autocomplete";
import type { Meta, StoryFn } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { fn } from "storybook/test";

import { Flex, Text, View } from "@phoenix/components";
import type { DSLFilterSnippet } from "@phoenix/components/filter";
import {
  AIQueryDSLFilterField,
  createAIQueryDSL,
  createAnnotationMemberCompletions,
  DSLFilterConditionField,
  type DSLFilterConditionFieldProps,
} from "@phoenix/components/filter";
import { PreferencesProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";

import { AIQueryRelayEnvironment } from "./utils/aiQueryRelayEnvironment";

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
  decorators: [
    // The AI query settings popover's model picker loads providers over
    // Relay; the stories answer it with a canned catalog
    (Story) => (
      <AIQueryRelayEnvironment>
        <Story />
      </AIQueryRelayEnvironment>
    ),
  ],
  parameters: {
    controls: { expanded: true },
  },
  args: {
    onValidCondition: fn(),
    onValidationStateChange: fn(),
  },
};

export default meta;

/**
 * The shared story shell: local value state, the rendered field, and an
 * "Applied condition" readout below it. Each template supplies the field.
 */
function FilterFieldHarness({
  renderField,
}: {
  renderField: (fieldProps: {
    value: string;
    onChange: (value: string) => void;
    onApplied: (condition: string) => void;
  }) => ReactNode;
}) {
  const [value, setValue] = useState<string>("");
  const [validCondition, setValidCondition] = useState<string>("");
  return (
    <View width="600px" padding="size-400">
      <Flex direction="column" gap="size-100">
        {renderField({
          value,
          onChange: setValue,
          onApplied: setValidCondition,
        })}
        <Text color="text-700" size="XS">
          {validCondition
            ? `Applied condition: ${validCondition}`
            : "No condition applied"}
        </Text>
      </Flex>
    </View>
  );
}

const Template: StoryFn<DSLFilterConditionFieldProps> = (args) => (
  <FilterFieldHarness
    renderField={({ value, onChange, onApplied }) => (
      <DSLFilterConditionField
        {...args}
        value={value}
        onChange={onChange}
        completions={completions}
        snippets={snippets}
        loadCompletions={loadCompletions}
        validateCondition={validateCondition}
        onValidCondition={(validCondition) => {
          onApplied(validCondition.condition);
          args.onValidCondition(validCondition);
        }}
      />
    )}
  />
);

/**
 * Focus the empty field to see suggested conditions and fields; type to
 * filter them. Suggestions insert with tab-through placeholders. Conditions
 * containing the word "invalid" fail validation to demonstrate the error
 * state.
 */
export const Default = {
  render: Template,
};

function AIQueryTemplate(args: DSLFilterConditionFieldProps) {
  return (
    <CredentialsProvider>
      <FilterFieldHarness
        renderField={({ value, onChange, onApplied }) => (
          <AIQueryDSLFilterField
            {...args}
            value={value}
            onChange={onChange}
            completions={completions}
            snippets={snippets}
            validateCondition={validateCondition}
            onValidCondition={(args) => onApplied(args.condition)}
            aiQuery={{
              dsl: createAIQueryDSL({
                noun: "records",
                completions,
                snippets,
              }),
              placeholder:
                "describe a record filter — Enter converts it to DSL",
            }}
          />
        )}
      />
    </CredentialsProvider>
  );
}

/**
 * The field with AI query available but not yet enabled: only the gear
 * shows, whose settings dropdown reports the feature is off and links to
 * the Generative AI page where it can be enabled. The next story seeds the
 * feature on to demonstrate the sparkle mode toggle.
 */
export const WithAIQuery: StoryFn<DSLFilterConditionFieldProps> =
  AIQueryTemplate;

/**
 * The field with AI query enabled, showing the sparkle mode toggle beside
 * the gear. The sparkle switches the field into plain-English mode: prose
 * input with no DSL affordances (no typeahead, syntax highlighting, or
 * validation), the PXI treatment on the border, and a sparkle leading icon
 * so the mode is unmistakable. Enter converts the draft with the configured
 * model — real conversions run in Chrome/Edge via the on-device model — and
 * lands the field back in DSL mode showing the generated expression; undo
 * (or Escape) restores your words and returns to plain-English mode.
 */
export const WithAIQueryEnabled: StoryFn<DSLFilterConditionFieldProps> = (
  args
) => (
  <PreferencesProvider isAIQueryEnabled>
    <AIQueryTemplate {...args} />
  </PreferencesProvider>
);

/**
 * Without `snippets` or `loadCompletions`, the typeahead surfaces only the
 * static field vocabulary.
 */
export const FieldsOnly: StoryFn<DSLFilterConditionFieldProps> = (args) => {
  const [value, setValue] = useState<string>("");
  return (
    <View width="600px" padding="size-400">
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
