import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Loading,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";

import { EvaluatorPlaygroundProjectSelect } from "./EvaluatorPlaygroundProjectSelect";
import type {
  EvaluatorPlaygroundSource,
  EvaluatorPlaygroundSourceKind,
} from "./evaluatorPlaygroundSource";

/**
 * The Results panel's scope controls: which kind of source, which dataset or
 * project, and for a project the span filter. The sample size lives in the
 * settings popover.
 * The filter keeps a draft; only a condition the server validated is applied.
 * The panel header is one fixed-height row that scrolls sideways, so the strip
 * stays on one line rather than wrapping.
 */
export function EvaluatorPlaygroundSourceStrip({
  source,
  sourceKind,
  isDisabled,
  onSourceKindChange,
  onSourceChange,
  onFilterValidityChange,
  onReload,
  children,
}: {
  source: EvaluatorPlaygroundSource | null;
  /** The kind the segmented control shows, even before a source is picked. */
  sourceKind: EvaluatorPlaygroundSourceKind;
  isDisabled: boolean;
  onSourceKindChange: (kind: EvaluatorPlaygroundSourceKind) => void;
  onSourceChange: (source: EvaluatorPlaygroundSource | null) => void;
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
              })
            }
          />
        )}
      </Suspense>
      {project ? (
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
