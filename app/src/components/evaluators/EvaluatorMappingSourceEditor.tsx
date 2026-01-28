import { useMemo } from "react";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
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
}[] = [
  {
    field: "input",
    label: "input",
    description: "The input field in the dataset example",
  },
  {
    field: "output",
    label: "output",
    description: "Output of your task. Modify this to match your use case",
  },
  {
    field: "reference",
    label: "reference",
    description: "The output field in the dataset example",
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
      {FIELD_CONFIG.map(({ field, label, description }) => (
        <EvaluatorMappingSourceFieldEditor
          key={field}
          field={field}
          label={label}
          description={description}
          value={value[field]}
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
        <Text weight="heavy" size="S">
          {label}
        </Text>
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
