import type { Completion } from "@codemirror/autocomplete";
import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  Dialog,
  Flex,
  Text,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import {
  type DSLFilterSnippet,
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

const longCondition =
  "parent_id is None and annotations['category'].label == 'alpha' and " +
  "annotations['quality'].score >= 0.8 and latency_ms >= 10_000 and " +
  "metadata['environment'] == 'production'";

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
  initialValue = "",
  renderField,
}: {
  initialValue?: string;
  renderField: (fieldProps: {
    value: string;
    onChange: (value: string) => void;
    onApplied: (condition: string) => void;
  }) => ReactNode;
}) {
  const [value, setValue] = useState<string>(initialValue);
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

function DSLFilterFieldStory({
  args,
  initialValue,
}: {
  args: DSLFilterConditionFieldProps;
  initialValue?: string;
}) {
  return (
    <FilterFieldHarness
      initialValue={initialValue}
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
}

const Template: StoryFn<DSLFilterConditionFieldProps> = (args) => (
  <DSLFilterFieldStory args={args} />
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

/**
 * A single-line condition that exceeds the field width. The editor keeps the
 * caret reachable through horizontal scrolling without adding vertical scroll
 * or moving the surrounding controls.
 */
export const LongCondition: StoryFn<DSLFilterConditionFieldProps> = (args) => (
  <DSLFilterFieldStory args={args} initialValue={longCondition} />
);

/**
 * The evaluator form renders the field inside a modal whose transformed,
 * overflow-clipped dialog would trap CodeMirror's fixed typeahead. This story
 * keeps that production geometry in the regression harness and opens the
 * suggestions as a user would.
 */
export const InModal = {
  render: (args: DSLFilterConditionFieldProps) => (
    <ViewportModalOverlay defaultOpen isDismissable={false}>
      <ViewportModal size="fullscreen">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Evaluator Scope</DialogTitle>
            </DialogHeader>
            <DSLFilterFieldStory args={args} />
          </DialogContent>
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  ),
  play: async () => {
    const body = within(document.body);
    const field = await body.findByRole("textbox", {
      name: "filter condition",
    });
    await userEvent.click(field);
    const listbox = await body.findByRole("listbox", {
      name: "Completions",
    });
    await expect(listbox).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      within(listbox).getByRole("option", {
        name: /filter by fast responses/i,
      })
    ).toHaveAttribute("aria-selected", "true");
  },
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

const clippedLayoutCSS = css`
  width: 600px;
  overflow: hidden;
  border: 1px dashed var(--global-border-color-default);
`;

/**
 * Dense form and table layouts often clip overflow at their bounds. The AI
 * treatment must keep its complete animated border visible in that geometry
 * rather than bleeding outside the field and losing its outer edges.
 */
export const WithAIQueryInClippedLayout = {
  render: (args: DSLFilterConditionFieldProps) => (
    <div css={clippedLayoutCSS}>
      <PreferencesProvider isAIQueryEnabled>
        <AIQueryTemplate {...args} />
      </PreferencesProvider>
    </div>
  ),
  play: async () => {
    const body = within(document.body);
    await userEvent.click(
      await body.findByRole("button", { name: "Plain-English query" })
    );
    const outline = document.querySelector(".ai-outline");
    await expect(outline).toHaveAttribute("data-glow-mode", "contained");
  },
};

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
