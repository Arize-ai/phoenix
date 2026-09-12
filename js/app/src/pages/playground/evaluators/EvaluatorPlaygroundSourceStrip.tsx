import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Input,
  ListBox,
  Loading,
  NumberField,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import {
  DEFAULT_TIME_WINDOW_PRESET_ID,
  TIME_WINDOW_PRESETS,
  isTimeWindowPresetId,
  type TimeWindowPresetId,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTimeWindow";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";

import { EvaluatorPlaygroundProjectSelect } from "./EvaluatorPlaygroundProjectSelect";
import { MAX_SAMPLE_SIZE } from "./EvaluatorPlaygroundSettingsButton";
import type {
  EvaluatorPlaygroundSource,
  EvaluatorPlaygroundSourceKind,
} from "./evaluatorPlaygroundSource";

/**
 * The Results panel's scope controls: which kind of source, which dataset or
 * project, how many rows, and for a project the span filter and time window.
 * The filter keeps a draft; only a condition the server validated is applied.
 * The panel header is one fixed-height row that scrolls sideways, so the strip
 * stays on one line rather than wrapping.
 */
export function EvaluatorPlaygroundSourceStrip({
  source,
  sourceKind,
  sampleSize,
  isDisabled,
  onSourceKindChange,
  onSourceChange,
  onSampleSizeChange,
  onFilterValidityChange,
  onReload,
  children,
}: {
  source: EvaluatorPlaygroundSource | null;
  /** The kind the segmented control shows, even before a source is picked. */
  sourceKind: EvaluatorPlaygroundSourceKind;
  sampleSize: number;
  isDisabled: boolean;
  onSourceKindChange: (kind: EvaluatorPlaygroundSourceKind) => void;
  onSourceChange: (source: EvaluatorPlaygroundSource | null) => void;
  onSampleSizeChange: (sampleSize: number) => void;
  onFilterValidityChange: (isValid: boolean) => void;
  /** Loads the sample again. */
  onReload: () => void;
  /** Actions that follow the scope controls (Save filter, settings). */
  children?: React.ReactNode;
}) {
  const project = source?.kind === "project" ? source : null;
  const dataset = source?.kind === "dataset" ? source : null;

  return (
    <Flex direction="row" alignItems="center" gap="size-100" flex="none">
      <SegmentedControl
        aria-label="Source"
        size="S"
        selectedKey={sourceKind}
        isDisabled={isDisabled}
        onSelectionChange={(key) => {
          if (key === "dataset" || key === "project") onSourceKindChange(key);
        }}
      >
        <SegmentedControlItem id="dataset">Dataset</SegmentedControlItem>
        <SegmentedControlItem id="project">Project</SegmentedControlItem>
      </SegmentedControl>
      <Suspense fallback={<Loading size="S" />}>
        {sourceKind === "dataset" ? (
          <DatasetSelectWithSplits
            size="S"
            placeholder="Select a dataset"
            isDisabled={isDisabled}
            value={
              dataset
                ? { datasetId: dataset.datasetId, splitIds: dataset.splitIds }
                : null
            }
            onSelectionChange={({ datasetId, splitIds }) =>
              onSourceChange(
                datasetId
                  ? { kind: "dataset", datasetId, splitIds, versionId: null }
                  : null
              )
            }
          />
        ) : (
          <EvaluatorPlaygroundProjectSelect
            projectId={project?.projectId ?? null}
            isDisabled={isDisabled}
            onSelectionChange={(projectId) =>
              onSourceChange({
                kind: "project",
                projectId,
                filterCondition: "",
                window: project?.window ?? DEFAULT_TIME_WINDOW_PRESET_ID,
              })
            }
          />
        )}
      </Suspense>
      <NumberField
        size="S"
        aria-label="Sample size"
        value={sampleSize}
        minValue={1}
        maxValue={MAX_SAMPLE_SIZE}
        step={1}
        isDisabled={isDisabled}
        css={sampleSizeCSS}
        onChange={(value) => {
          if (Number.isInteger(value) && value >= 1)
            onSampleSizeChange(Math.min(value, MAX_SAMPLE_SIZE));
        }}
      >
        <Input />
      </NumberField>
      <Text size="S" color="text-500">
        {sourceKind === "dataset" ? "examples" : "spans"}
      </Text>
      {project ? (
        <>
          <EvaluatorPlaygroundFilterField
            key={project.projectId}
            projectId={project.projectId}
            appliedCondition={project.filterCondition}
            isDisabled={isDisabled}
            onApply={(filterCondition) =>
              onSourceChange({ ...project, filterCondition })
            }
            onValidityChange={onFilterValidityChange}
          />
          <TimeWindowSelect
            value={project.window}
            isDisabled={isDisabled}
            onChange={(window) => onSourceChange({ ...project, window })}
          />
        </>
      ) : null}
      {source ? (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label="Reload sample"
            isDisabled={isDisabled}
            onPress={onReload}
          >
            <Icon svg={<Icons.Refresh />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Load the latest {sourceKind === "dataset" ? "examples" : "spans"}
          </Tooltip>
        </TooltipTrigger>
      ) : null}
      {children}
    </Flex>
  );
}

/**
 * The span filter with the same draft/validated split as the project
 * evaluator form: what is typed is the draft, what the server accepted is
 * applied. An applied condition set from outside (PXI, a link) replaces the
 * draft.
 */
function EvaluatorPlaygroundFilterField({
  projectId,
  appliedCondition,
  isDisabled,
  onApply,
  onValidityChange,
}: {
  projectId: string;
  appliedCondition: string;
  isDisabled: boolean;
  onApply: (filterCondition: string) => void;
  onValidityChange: (isValid: boolean) => void;
}) {
  const [draft, setDraft] = useState(appliedCondition);
  const [tracked, setTracked] = useState(appliedCondition);

  if (tracked !== appliedCondition) {
    setTracked(appliedCondition);
    setDraft(appliedCondition);
  }

  return (
    <div css={filterFieldCSS} aria-disabled={isDisabled}>
      <SpanFilterConditionFieldCore
        size="S"
        projectId={projectId}
        filterCondition={draft}
        onFilterConditionChange={setDraft}
        placeholder="span_kind == 'LLM'"
        onValidCondition={({ condition, isInitialSettlement }) => {
          if (!isInitialSettlement && condition !== appliedCondition)
            onApply(condition);
        }}
        onValidityChange={onValidityChange}
      />
    </div>
  );
}

function TimeWindowSelect({
  value,
  isDisabled,
  onChange,
}: {
  value: TimeWindowPresetId;
  isDisabled: boolean;
  onChange: (window: TimeWindowPresetId) => void;
}) {
  return (
    <Select
      aria-label="Time window"
      size="S"
      value={value}
      isDisabled={isDisabled}
      onChange={(key) => {
        if (typeof key === "string" && isTimeWindowPresetId(key)) onChange(key);
      }}
    >
      <Button leadingVisual={<Icon svg={<Icons.Clock />} />}>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {TIME_WINDOW_PRESETS.map((preset) => (
            <SelectItem key={preset.id} id={preset.id} textValue={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

// Wide enough for a two- or three-digit count and the stepper.
const sampleSizeCSS = css`
  width: 96px;
`;

// The filter is a code editor, not a one-line input; a fixed width keeps the
// header row stable while the condition is typed.
const filterFieldCSS = css`
  flex: none;
  width: 320px;
  &[aria-disabled="true"] {
    pointer-events: none;
    opacity: 0.6;
  }
`;
