import { css } from "@emotion/react";
import type { BasicSetupOptions } from "@uiw/react-codemirror";

import { ContextualHelp, Flex, Text } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { useDebouncedJSONSync } from "@phoenix/hooks";
import type {
  EvaluatorMappingSource,
  EvaluatorMappingSourceGrain,
} from "@phoenix/types";

type EvaluatorMappingSourceFieldConfig<
  TGrain extends EvaluatorMappingSourceGrain,
> = {
  field: Extract<keyof EvaluatorMappingSource<TGrain>, string>;
  label: string;
  description: string;
  tooltip: string;
};

const DATASET_FIELD_CONFIG: EvaluatorMappingSourceFieldConfig<"dataset">[] = [
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

const SPAN_FIELD_CONFIG: EvaluatorMappingSourceFieldConfig<"span">[] = [
  {
    field: "input",
    label: "input",
    description: "From the matched span's input.",
    tooltip:
      "This is the input extracted from the matched span using OpenInference semantic conventions.",
  },
  {
    field: "output",
    label: "output",
    description: "From the matched span's output.",
    tooltip:
      "This is the output extracted from the matched span using OpenInference semantic conventions.",
  },
  {
    field: "metadata",
    label: "metadata",
    description: "From the matched span. Span attributes are under attributes.",
    tooltip:
      "Span attributes are available for path mapping under metadata.attributes.",
  },
];

const editorContainerCSS = css`
  min-height: 60px;
  border-radius: var(--global-rounding-small);
  background-color: var(--global-input-field-background-color);
`;

type EvaluatorMappingSourceEditorProps = {
  [TGrain in EvaluatorMappingSourceGrain]: {
    grain: TGrain;
    value: EvaluatorMappingSource<TGrain>;
    onFieldChange: (
      field: Extract<keyof EvaluatorMappingSource<TGrain>, string>,
      value: Record<string, unknown>
    ) => void;
    editorKeyPrefix?: string;
  };
}[EvaluatorMappingSourceGrain];

export function EvaluatorMappingSourceEditor(
  props: EvaluatorMappingSourceEditorProps
) {
  if (props.grain === "span") {
    return (
      <EvaluatorMappingSourceFields
        {...props}
        fieldConfig={SPAN_FIELD_CONFIG}
      />
    );
  }
  return (
    <EvaluatorMappingSourceFields
      {...props}
      fieldConfig={DATASET_FIELD_CONFIG}
    />
  );
}

function EvaluatorMappingSourceFields<
  TGrain extends EvaluatorMappingSourceGrain,
>({
  value,
  onFieldChange,
  editorKeyPrefix = "",
  fieldConfig,
}: {
  value: EvaluatorMappingSource<TGrain>;
  onFieldChange: (
    field: Extract<keyof EvaluatorMappingSource<TGrain>, string>,
    value: Record<string, unknown>
  ) => void;
  editorKeyPrefix?: string;
  fieldConfig: EvaluatorMappingSourceFieldConfig<TGrain>[];
}) {
  const defaultExpandedKeys = fieldConfig.map(({ field }) => field as string);
  return (
    <DisclosureGroup defaultExpandedKeys={defaultExpandedKeys}>
      {fieldConfig.map(({ field, label, description, tooltip }) => (
        <EvaluatorMappingSourceFieldEditor
          key={field as string}
          field={field as string}
          label={label}
          description={description}
          tooltip={tooltip}
          value={value[field] as Record<string, unknown>}
          onChange={(newValue) => onFieldChange(field, newValue)}
          editorKey={`${editorKeyPrefix}-${field as string}`}
        />
      ))}
    </DisclosureGroup>
  );
}

type EvaluatorMappingSourceFieldEditorProps = {
  field: string;
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
  const stringValue = JSON.stringify(value, null, 2);

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
