import { useMemo } from "react";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { ContextualHelp, Flex, Text } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/disclosure";
import { useDebouncedJSONSync } from "@phoenix/hooks";
import type { EvaluatorMappingSource } from "@phoenix/types";

type EvaluatorMappingSourceField = keyof EvaluatorMappingSource;

type EvaluatorMappingSourceEditorProps = {
  /**
   * The current evaluator mapping source values
   */
  value: EvaluatorMappingSource;
  /**
   * Callback when a field value changes
   */
  onFieldChange: (
    field: EvaluatorMappingSourceField,
    value: Record<string, unknown>
  ) => void;
  /**
   * Unique key prefix for the editors (used to force re-render on dataset change)
   */
  editorKeyPrefix?: string;
};

const FIELD_CONFIG: {
  field: EvaluatorMappingSourceField;
  label: string;
  description: string;
  tooltip: string;
}[] = [
  {
    field: "input",
    label: "input",
    description:
      "From the dataset example. This is the input that will be passed to your task.",
    tooltip:
      "This value comes from the selected dataset example's input field. When running experiments, your task will receive inputs like this.",
  },
  {
    field: "output",
    label: "output",
    description:
      "Sample task output (editable). Replace this with data matching your actual task's output format.",
    tooltip:
      "This represents what your task (e.g., your LLM application) produces when given the input. The default is a sample - edit it to match your actual output format so the evaluator can correctly extract values.",
  },
  {
    field: "reference",
    label: "reference",
    description:
      "From the dataset example. An optional reference point for comparison.",
    tooltip:
      "This value comes from the selected dataset example's output field. It can be used as a reference point for comparison, but is not always present or required.",
  },
  {
    field: "metadata",
    label: "metadata",
    description:
      "From the dataset example. Optional metadata (e.g. user_id, category) for path mapping.",
    tooltip:
      "This value comes from the selected dataset example's metadata field. When running evaluators over a dataset, you can map evaluator inputs to metadata paths (e.g. metadata.user_id).",
  },
];

const editorContainerCSS = css`
  min-height: 60px;
  border-radius: var(--ac-global-rounding-small);
  background-color: var(--ac-global-input-field-background-color);
`;

const DEFAULT_EXPANDED_KEYS = FIELD_CONFIG.map(({ field }) => field);

/**
 * A component that renders three collapsible JSON editors for editing
 * the evaluator mapping source fields (input, output, reference).
 */
export function EvaluatorMappingSourceEditor({
  value,
  onFieldChange,
  editorKeyPrefix = "",
}: EvaluatorMappingSourceEditorProps) {
  // memoize the field callbacks to avoid re-creating them on every render
  const fieldCallbacks = useMemo(() => {
    return Object.fromEntries(
      FIELD_CONFIG.map(({ field }) => {
        return [
          field,
          (newValue: Record<string, unknown>) => onFieldChange(field, newValue),
        ];
      })
    );
  }, [onFieldChange]);
  return (
    <DisclosureGroup defaultExpandedKeys={DEFAULT_EXPANDED_KEYS}>
      {FIELD_CONFIG.map(({ field, label, description, tooltip }) => (
        <EvaluatorMappingSourceFieldEditor
          key={field}
          field={field}
          label={label}
          description={description}
          tooltip={tooltip}
          value={value[field] ?? {}}
          onChange={fieldCallbacks[field]}
          editorKey={`${editorKeyPrefix}-${field}`}
        />
      ))}
    </DisclosureGroup>
  );
}

type EvaluatorMappingSourceFieldEditorProps = {
  field: EvaluatorMappingSourceField;
  label: string;
  description: string;
  tooltip: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  editorKey: string;
};

const JSONEditorBasicSetup: BasicSetupOptions = {
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  searchKeymap: false,
};

function EvaluatorMappingSourceFieldEditor({
  field,
  label,
  description,
  tooltip,
  value,
  onChange,
  editorKey,
}: EvaluatorMappingSourceFieldEditorProps) {
  const stringValue = useMemo(() => {
    return JSON.stringify(value, null, 2);
  }, [value]);

  const debouncedSync = useDebouncedJSONSync<Record<string, unknown>>(onChange);

  return (
    <Disclosure
      id={field}
      css={css`
        &:last-child:not([data-expanded="true"]) {
          .react-aria-Button[slot="trigger"] {
            border-bottom: none;
          }
        }
      `}
    >
      <DisclosureTrigger>
        <Flex direction="row" gap="size-50" alignItems="center">
          <Text weight="heavy" size="S">
            {label}
          </Text>
          <ContextualHelp variant="info">
            <Text>{tooltip}</Text>
          </ContextualHelp>
        </Flex>
        <Text
          color="text-500"
          size="XS"
          css={css`
            text-align: left;
          `}
        >
          {description}
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <div css={editorContainerCSS}>
          <JSONEditor
            key={editorKey}
            value={stringValue}
            onChange={debouncedSync}
            basicSetup={JSONEditorBasicSetup}
          />
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
