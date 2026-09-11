import { css } from "@emotion/react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { useState, type ComponentProps, type ReactNode } from "react";
import { shallow } from "zustand/shallow";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Counter,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { ColumnSelectorMenu } from "@phoenix/components/table/columnSelector";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { isStringKeyedObject } from "@phoenix/typeUtils";

import type {
  CalibrationExample,
  CalibrationRun,
  ExpectedOutput,
  SlotExpectations,
} from "../calibration";
import { getExpectedVerdict } from "../calibration";
import type { SlotId, SlotSnapshot } from "../evaluatorSlotTypes";
import type { ExpectedOutputSaveStatus } from "../expectedOutputQueue";
import { CalibrationResultsTable } from "./CalibrationResultsTable";
import { EvaluatorCell } from "./EvaluatorCell";
import { EvaluatorColumnHeader } from "./EvaluatorColumnHeader";
import {
  EvaluatorPlaygroundResultsTableProvider,
  useEvaluatorPlaygroundResultsTablePreferences,
} from "./EvaluatorPlaygroundResultsTableContext";
import {
  EXAMPLE_FIELD_LABELS,
  EXAMPLE_FIELDS,
  ExampleFieldCell,
  type ExampleField,
} from "./ExampleFieldCell";
import { ExpectedOutputSaveIndicator } from "./ExpectedOutputSaveIndicator";
import { RowCell } from "./RowCell";

/** Retain only presentation data. Action handlers always come from the current
 * workspace, so the loading snapshot cannot execute or save against old data. */
export function CalibrationResults(
  props: ComponentProps<typeof CalibrationResultsContent>
) {
  const nextSnapshot = {
    isReady: !props.isLoading,
    examples: props.examples,
    sampleSize: props.sampleSize,
    runs: props.runs,
    slots: props.slots,
    visibleSlotIds: props.visibleSlotIds,
    expected: props.expected,
    filter: props.filter,
    staleSlots: props.staleSlots,
    isRunning: props.isRunning,
    runnableSlots: props.runnableSlots,
    saveStatus: props.saveStatus,
    pendingCount: props.pendingCount,
    hideExpectedAnnotations: props.hideExpectedAnnotations,
  };

  const [snapshot, setSnapshot] = useState(nextSnapshot);

  if (!props.isLoading && !shallow(snapshot, nextSnapshot)) {
    setSnapshot(nextSnapshot);
  }

  const { isReady, ...displayed } = props.isLoading ? snapshot : nextSnapshot;
  const isShowingPreviousSample = props.isLoading && isReady;

  return (
    <EvaluatorPlaygroundResultsTableProvider>
      <div css={resultsSnapshotCSS}>
        <div inert={props.isLoading} css={resultsContentCSS}>
          <CalibrationResultsContent {...props} {...displayed} />
        </div>
        {isShowingPreviousSample ? (
          <div css={loadingOverlayCSS} role="status">
            <Flex direction="column" alignItems="center" gap="size-100">
              <ProgressCircle isIndeterminate aria-label="Loading sample" />
              <Text weight="heavy">Loading sample…</Text>
              <Text size="S">Previous results shown · review paused</Text>
            </Flex>
          </div>
        ) : null}
      </div>
    </EvaluatorPlaygroundResultsTableProvider>
  );
}

const resultsSnapshotCSS = css`
  position: relative;
  height: 100%;
  min-height: 0;
`;

const resultsContentCSS = css`
  position: relative;
  z-index: 0;
  height: 100%;
  min-height: 0;
`;

const loadingOverlayCSS = css`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--global-background-color-default) 80%,
    transparent
  );
`;

function CalibrationResultsContent({
  examples,
  sampleSize,
  isLoading,
  runs,
  slots,
  visibleSlotIds,
  expected,
  filter,
  onFilterChange,
  onSaveExpectedOutput,
  isRunning,
  runnableSlots,
  onRunSlot,
  onRunExample,
  saveStatus,
  pendingCount,
  hideExpectedAnnotations,
  expectedOutputError,
  staleSlots,
  onRetryExpectedOutputs,
  onReloadSample,
}: {
  examples: CalibrationExample[];
  sampleSize: number;
  isLoading: boolean;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  visibleSlotIds: SlotId[];
  expected: SlotExpectations;
  filter: string;
  onFilterChange: (filter: string) => void;
  onSaveExpectedOutput: (
    example: CalibrationExample,
    slot: SlotId,
    output: ExpectedOutput | null
  ) => Promise<UIOperationResult>;
  /** Any slot is executing; every play control waits for it to finish. */
  isRunning: boolean;
  /** Slots whose draft is complete enough to execute. */
  runnableSlots: SlotId[];
  /** Run one evaluator over the whole sample (the column's play button). */
  onRunSlot: (slot: SlotId) => void;
  /** Run every evaluator on one example (the row's play button). */
  onRunExample: (exampleId: string) => void;
  /** Where the annotation queue stands, for the header's save indicator. */
  saveStatus: ExpectedOutputSaveStatus;
  pendingCount: number;
  /** Leave the `annotations` key out of the metadata cells. */
  hideExpectedAnnotations: boolean;
  expectedOutputError: string | null;
  staleSlots: string[];
  onRetryExpectedOutputs: () => void;
  onReloadSample: () => void;
}) {
  const positions = new Map(
    examples.map((example, index) => [example.id, index + 1])
  );

  const selectedOutput = (slot: SlotId) =>
    slots[slot]?.outputNames.find(
      (output) => output.name === slots[slot]?.selectedOutputName
    );

  const verdictFor = (slot: SlotId, example: CalibrationExample) =>
    getExpectedVerdict({
      prediction: runs[slot]?.predictions[example.id],
      expected: expected[slot]?.[example.id],
      output: selectedOutput(slot),
    });

  const views = [
    { id: "all", label: "All", examples },
    {
      id: "missing-expected",
      label: "Missing expected",
      examples: examples.filter((example) =>
        visibleSlotIds.some((slot) => !expected[slot]?.[example.id])
      ),
    },
    {
      id: "errors",
      label: "Errors",
      examples: examples.filter((example) =>
        visibleSlotIds.some(
          (slot) => runs[slot]?.predictions[example.id]?.status === "error"
        )
      ),
    },
    {
      // Anything the expectation can't be squared with: a result that differs
      // from it, or an expectation the output config can no longer produce.
      id: "disagreements",
      label: "Mismatches",
      examples: examples.filter((example) =>
        visibleSlotIds.some((slot) => {
          const verdict = verdictFor(slot, example);

          return verdict === "mismatch" || verdict === "invalid";
        })
      ),
    },
  ];

  const activeView = views.find((view) => view.id === filter) ?? views[0];

  const canRunRows =
    !isLoading &&
    !isRunning &&
    visibleSlotIds.length > 0 &&
    visibleSlotIds.every((slot) => runnableSlots.includes(slot));

  // Which example fields show. Metadata starts hidden unless the sample has
  // some: an evaluator may read it, but a column of empty objects says nothing.
  // Once someone toggles a column, their choice persists and wins.
  const storedVisibility = useEvaluatorPlaygroundResultsTablePreferences(
    (state) => state.columnVisibility
  );

  const setColumnVisibility = useEvaluatorPlaygroundResultsTablePreferences(
    (state) => state.setColumnVisibility
  );

  const hasMetadata = examples.some(
    (example) =>
      isStringKeyedObject(example.metadata) &&
      Object.keys(example.metadata).length > 0
  );

  const columnVisibility: VisibilityState = {
    metadata: hasMetadata,
    ...storedVisibility,
  };

  const showsField = (field: ExampleField) => columnVisibility[field] !== false;
  const visibleFields = EXAMPLE_FIELDS.filter(showsField);

  const columns: ColumnDef<unknown>[] = [
    // The row's own column: its number, and the play button that runs every
    // evaluator on just this example.
    {
      id: "row",
      header: () => <VisuallyHiddenHeader>Example</VisuallyHiddenHeader>,
      size: ROW_COLUMN_WIDTH,
      minSize: ROW_COLUMN_WIDTH,
      enableResizing: false,
    },
    { id: "input", header: "Input", size: 300, minSize: 200 },
    { id: "output", header: "Output", size: 300, minSize: 200 },
    { id: "metadata", header: "Metadata", size: 300, minSize: 200 },
    ...visibleSlotIds.map((slot) => ({
      id: slot,
      size: 240,
      minSize: 180,
      header: () => (
        <EvaluatorColumnHeader
          slot={slot}
          name={slots[slot]?.name}
          run={runs[slot]}
          expected={expected[slot]}
          output={selectedOutput(slot)}
          examples={examples}
          canRun={!isLoading && !isRunning && runnableSlots.includes(slot)}
          onRun={() => onRunSlot(slot)}
        />
      ),
    })),
  ];

  return (
    <Flex direction="column" height="100%" minHeight={0}>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-200"
          wrap
        >
          <Flex direction="row" gap="size-200" alignItems="center">
            <Text size="S" color="text-500">
              {isLoading && !examples.length
                ? "Loading sample…"
                : examples.length < sampleSize
                  ? `All ${examples.length} examples`
                  : `First ${sampleSize} examples`}
            </Text>
            <ExpectedOutputSaveIndicator
              status={saveStatus}
              pendingCount={pendingCount}
            />
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center">
            <SegmentedControl
              aria-label="Show results"
              size="S"
              selectedKey={activeView.id}
              onSelectionChange={(key) => onFilterChange(String(key))}
            >
              {views.map((view) => (
                <SegmentedControlItem key={view.id} id={view.id}>
                  <Flex direction="row" gap="size-75" alignItems="center">
                    {view.label}
                    <Counter
                      variant={view.id === activeView.id ? "quiet" : "default"}
                    >
                      {view.examples.length}
                    </Counter>
                  </Flex>
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            {/* Only the example fields are optional; the row column and the
                evaluators are what the table is for. */}
            <DialogTrigger>
              <Button size="S" leadingVisual={<Icon svg={<Icons.Column />} />}>
                Columns
              </Button>
              <Popover placement="bottom end">
                <ColumnSelectorMenu
                  columns={EXAMPLE_FIELDS.map((field) => ({
                    id: field,
                    label: EXAMPLE_FIELD_LABELS[field],
                  }))}
                  columnVisibility={columnVisibility}
                  onColumnVisibilityChange={setColumnVisibility}
                />
              </Popover>
            </DialogTrigger>
          </Flex>
        </Flex>
      </View>
      {staleSlots.length ? (
        <Alert variant="warning" banner>
          Evaluators {staleSlots.join(", ")} changed since the last run. Run
          again to review the current drafts.
        </Alert>
      ) : null}
      {expectedOutputError ? (
        <Alert
          variant="danger"
          banner
          title="Could not save annotations"
          extra={
            // The message can be long; it wraps, the buttons don't shrink.
            <Flex direction="row" gap="size-100" flex="none">
              <Button
                size="S"
                isDisabled={saveStatus === "saving"}
                onPress={onRetryExpectedOutputs}
              >
                Retry
              </Button>
              <Button
                size="S"
                isDisabled={saveStatus === "saving"}
                onPress={onReloadSample}
              >
                Load latest sample
              </Button>
            </Flex>
          }
        >
          {expectedOutputError}
        </Alert>
      ) : null}
      <div css={tableWrapCSS}>
        <CalibrationResultsTable
          columns={columns}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          isLoading={isLoading}
        >
          {isLoading && !examples.length ? (
            <tbody>
              <tr>
                <td colSpan={visibleSlotIds.length + visibleFields.length + 1}>
                  <View paddingY="size-200">
                    <Loading size="S" />
                  </View>
                </td>
              </tr>
            </tbody>
          ) : !activeView.examples.length ? (
            <TableEmptyWrap>
              <CompactEmptyState
                icon={<Icon svg={<Icons.Database />} />}
                description="No examples"
                isFiltered={filter !== "all"}
              />
            </TableEmptyWrap>
          ) : (
            <tbody>
              {activeView.examples.map((example) => {
                const position = positions.get(example.id)!;

                return (
                  <tr key={example.id}>
                    <td className="table__cell results-table__row-cell">
                      <RowCell
                        position={position}
                        isPending={visibleSlotIds.some((slot) =>
                          runs[slot]?.queued.includes(example.id)
                        )}
                        canRun={canRunRows}
                        onRun={() => onRunExample(example.id)}
                      />
                    </td>
                    {visibleFields.map((field) => (
                      <td
                        className="table__cell results-table__example-cell"
                        key={field}
                      >
                        <ExampleFieldCell
                          label={field}
                          value={example[field]}
                          position={position}
                          hideExpectedAnnotations={hideExpectedAnnotations}
                        />
                      </td>
                    ))}
                    {visibleSlotIds.map((slot) => (
                      <td
                        className="table__cell results-table__evaluator-cell"
                        key={slot}
                      >
                        <EvaluatorCell
                          key={JSON.stringify([
                            slots[slot]?.name,
                            slots[slot]?.selectedOutputName,
                            slots[slot]?.outputNames.length === 1,
                          ])}
                          slot={slot}
                          name={slots[slot]?.name || `Evaluator ${slot}`}
                          position={position}
                          result={runs[slot]?.predictions[example.id]}
                          isLoading={isLoading}
                          isPending={!!runs[slot]?.queued.includes(example.id)}
                          expected={expected[slot]?.[example.id]}
                          output={selectedOutput(slot)}
                          slotRevision={slots[slot]?.revision}
                          isDisabled={
                            isLoading || !slots[slot]?.selectedOutputName
                          }
                          onSave={(output) =>
                            onSaveExpectedOutput(example, slot, output)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          )}
        </CalibrationResultsTable>
      </div>
    </Flex>
  );
}

// Wide enough for a two-digit row number over a small play button.
const ROW_COLUMN_WIDTH = 48;

/** A column header for a column whose meaning is carried by its cells. */
function VisuallyHiddenHeader({ children }: { children: ReactNode }) {
  return <span css={visuallyHiddenCSS}>{children}</span>;
}

const visuallyHiddenCSS = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

// The table is as wide as its columns add up to, and scrolls inside this
// wrap. Without min-width: 0 a flex item refuses to be narrower than its
// content, so a table wider than the panel would push the whole column — the
// toolbar and any banner above it — out past the panel's edge.
const tableWrapCSS = css`
  overflow: auto;
  scroll-padding-top: var(--global-dimension-size-800);
  flex: 1;
  min-height: 0;
  min-width: 0;
`;
