import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Alert,
  Button,
  Counter,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONBlock } from "@phoenix/components/code";
import { JSONText } from "@phoenix/components/code/JSONText";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";

import type {
  CalibrationExample,
  CalibrationPrediction,
  CalibrationRun,
} from "./calibration";
import { getCalibrationAgreement } from "./calibration";
import { CalibrationSelect } from "./CalibrationSelect";
import type { SlotId } from "./evaluatorSlotTypes";
import { getSlotIndex } from "./evaluatorSlotTypes";

const NO_VALUE = "—";

export function CalibrationResults({
  examples,
  sampleSize,
  runs,
  slotNames,
  expected,
  labels,
  hasComparison,
  isCompatible,
  filter,
  onFilterChange,
  onReview,
  savingId,
  reviewError,
  staleSlots,
  onRetryReview,
  onReloadSample,
}: {
  examples: CalibrationExample[];
  sampleSize: number;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  slotNames: Partial<Record<SlotId, string>>;
  expected: Partial<Record<string, string>>;
  labels: string[];
  hasComparison: boolean;
  isCompatible: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
  onReview: (example: CalibrationExample, label: string | null) => void;
  savingId: string | null;
  reviewError: string | null;
  staleSlots: string[];
  onRetryReview: () => void;
  onReloadSample: () => void;
}) {
  const slots: SlotId[] = hasComparison ? ["A", "B"] : ["A"];
  const baselineLabels: Partial<Record<string, string>> = {};
  for (const example of examples) {
    const result = runs.A?.predictions[example.id];
    if (result?.status === "success") baselineLabels[example.id] = result.label;
  }
  const agreement = getCalibrationAgreement({
    expected: baselineLabels,
    predictions: runs.B?.predictions ?? {},
  });
  // Every view is a subset of the same sample, so each option carries its
  // count: a reviewer can see how much is left without switching views.
  const views: { id: string; label: string; examples: CalibrationExample[] }[] =
    [
      { id: "all", label: "All", examples },
      {
        id: "unreviewed",
        label: "Unreviewed",
        examples: examples.filter((example) => expected[example.id] == null),
      },
      {
        id: "errors",
        label: "Errors",
        examples: examples.filter((example) =>
          slots.some(
            (slotId) =>
              runs[slotId]?.predictions[example.id]?.status === "error"
          )
        ),
      },
      ...(hasComparison
        ? [
            {
              id: "disagreements",
              label: "Disagreements",
              examples: examples.filter((example) => {
                const first = runs.A?.predictions[example.id];
                const second = runs.B?.predictions[example.id];
                return (
                  isCompatible &&
                  first?.status === "success" &&
                  second?.status === "success" &&
                  first.label !== second.label
                );
              }),
            },
          ]
        : []),
    ];
  const activeView = views.find((view) => view.id === filter) ?? views[0];
  const filtered = activeView.examples;
  const reviewedCount = Object.keys(expected).length;
  const isSaving = savingId != null;
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
          <Flex direction="row" gap="size-400" alignItems="center">
            <Stat
              label="Sample"
              value={
                examples.length < sampleSize
                  ? `${examples.length}`
                  : `First ${sampleSize}`
              }
            />
            <Stat
              label="Reviewed"
              value={`${reviewedCount} / ${examples.length}`}
            />
            {slots.map((slotId) => (
              <Stat
                key={slotId}
                label={`${slotId} vs expected`}
                value={formatAgreement(
                  !runs[slotId] || (slotId === "B" && !isCompatible)
                    ? null
                    : getCalibrationAgreement({
                        expected,
                        predictions: runs[slotId]?.predictions ?? {},
                      })
                )}
              />
            ))}
            {hasComparison ? (
              <Stat
                label="B vs A"
                value={formatAgreement(isCompatible ? agreement : null)}
              />
            ) : null}
          </Flex>
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
        </Flex>
      </View>
      {staleSlots.length ? (
        <Alert variant="warning" banner>
          {staleSlots.length === 1
            ? `Evaluator ${staleSlots[0]} has`
            : `Evaluators ${staleSlots.join(" and ")} have`}{" "}
          changed since the last run. Run again to compare the current drafts.
        </Alert>
      ) : null}
      {hasComparison && !isCompatible ? (
        <Alert variant="warning" banner>
          A and B need categorical outputs with the same labels to be compared.
          Label remapping is not supported.
        </Alert>
      ) : null}
      {reviewError ? (
        <Alert
          variant="danger"
          banner
          title="Could not save expected label"
          extra={
            <Flex direction="row" gap="size-100" flex="none">
              <Button size="S" isDisabled={isSaving} onPress={onRetryReview}>
                Retry
              </Button>
              <Button size="S" isDisabled={isSaving} onPress={onReloadSample}>
                Load latest sample
              </Button>
            </Flex>
          }
        >
          {reviewError}
        </Alert>
      ) : null}
      <div css={tableWrapCSS}>
        <table
          css={css(tableCSS, borderedTableCSS)}
          aria-label="Evaluator comparison results"
        >
          <thead>
            <tr>
              <th css={indexColumnCSS}>#</th>
              <th>Example</th>
              {slots.map((slotId) => {
                const run = runs[slotId];
                return (
                  <th key={slotId} css={slotColumnCSS}>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <AlphabeticIndexIcon
                        index={getSlotIndex(slotId)}
                        size="XS"
                      />
                      <Truncate maxWidth="100%">
                        {slotNames[slotId] || `Evaluator ${slotId}`}
                      </Truncate>
                      {run?.isRunning ? (
                        <Flex
                          direction="row"
                          gap="size-50"
                          alignItems="center"
                          flex="none"
                        >
                          <ProgressCircle isIndeterminate size="S" />
                          <Text size="XS" color="text-500" fontFamily="mono">
                            {Object.keys(run.predictions).length}/{run.total}
                          </Text>
                        </Flex>
                      ) : null}
                    </Flex>
                  </th>
                );
              })}
              <th css={expectedColumnCSS}>Expected label</th>
            </tr>
          </thead>
          {filtered.length === 0 ? (
            <TableEmptyWrap>
              <CompactEmptyState
                icon={<Icon svg={<Icons.Database />} />}
                description="No examples"
                isFiltered={filter !== "all"}
              />
            </TableEmptyWrap>
          ) : (
            <tbody>
              {filtered.map((example) => {
                const position = examples.indexOf(example) + 1;
                const baseline = runs.A?.predictions[example.id];
                const expectedLabel = expected[example.id];
                const canAcceptBaseline =
                  baseline?.status === "success" &&
                  expectedLabel == null &&
                  !staleSlots.includes("A");
                return (
                  <tr key={example.id}>
                    <td className="table__cell" css={indexColumnCSS}>
                      <Text color="text-500" fontFamily="mono">
                        {position}
                      </Text>
                    </td>
                    <td className="table__cell">
                      <ExampleCell example={example} position={position} />
                    </td>
                    {slots.map((slotId) => (
                      <td className="table__cell" key={slotId}>
                        <Prediction
                          result={runs[slotId]?.predictions[example.id]}
                          isPending={
                            !!runs[slotId]?.isRunning &&
                            runs[slotId]?.predictions[example.id] == null
                          }
                          expected={
                            slotId === "B" && !isCompatible
                              ? undefined
                              : expectedLabel
                          }
                        />
                      </td>
                    ))}
                    <td className="table__cell">
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <CalibrationSelect
                          hideLabel
                          label={`Expected label for example ${position}`}
                          value={
                            expectedLabel == null
                              ? "unreviewed"
                              : `label:${expectedLabel}`
                          }
                          isDisabled={isSaving || labels.length === 0}
                          options={[
                            { id: "unreviewed", name: "Unreviewed" },
                            ...labels.map((label) => ({
                              id: `label:${label}`,
                              name: label,
                            })),
                          ]}
                          onChange={(label) =>
                            onReview(
                              example,
                              label === "unreviewed" ? null : label.slice(6)
                            )
                          }
                        />
                        {savingId === example.id ? (
                          <ProgressCircle isIndeterminate size="S" />
                        ) : canAcceptBaseline ? (
                          <Button
                            size="S"
                            variant="quiet"
                            leadingVisual={<Icon svg={<Icons.Checkmark />} />}
                            isDisabled={isSaving}
                            onPress={() => {
                              if (baseline?.status === "success")
                                onReview(example, baseline.label);
                            }}
                          >
                            Accept A
                          </Button>
                        ) : null}
                      </Flex>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </Flex>
  );
}

const tableWrapCSS = css`
  overflow: auto;
  flex: 1;
  min-height: 0;
`;

const indexColumnCSS = css`
  width: var(--global-dimension-size-500);
  text-align: right;
`;

const slotColumnCSS = css`
  min-width: var(--global-dimension-size-2400);
`;

const expectedColumnCSS = css`
  width: var(--global-dimension-size-3000);
`;

function formatAgreement(
  agreement: ReturnType<typeof getCalibrationAgreement> | null
) {
  if (agreement == null || agreement.percent == null) return NO_VALUE;
  return `${agreement.percent}%`;
}

/** A label over a value, for the results summary strip. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" gap="size-25">
      <Text size="XS" color="text-500">
        {label}
      </Text>
      <Text size="M" weight="heavy" fontFamily="mono">
        {value}
      </Text>
    </Flex>
  );
}

const exampleFieldCSS = css`
  display: grid;
  grid-template-columns: var(--global-dimension-size-600) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  align-items: baseline;
  .font-mono,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** The example's input and output at a glance, with the full JSON a click away. */
function ExampleCell({
  example,
  position,
}: {
  example: CalibrationExample;
  position: number;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Flex direction="column" gap="size-50" flex="1 1 auto" minWidth={0}>
        <div css={exampleFieldCSS}>
          <Text size="XS" color="text-500">
            input
          </Text>
          <Text size="S">
            <JSONText json={example.input} maxLength={120} disableTitle />
          </Text>
        </div>
        <div css={exampleFieldCSS}>
          <Text size="XS" color="text-500">
            output
          </Text>
          <Text size="S">
            <JSONText json={example.output} maxLength={120} disableTitle />
          </Text>
        </div>
      </Flex>
      <DetailsPopover
        label={`View example ${position}`}
        icon={<Icons.Expand />}
        width={560}
      >
        <JSONBlock
          value={JSON.stringify(
            { input: example.input, output: example.output },
            null,
            2
          )}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </DetailsPopover>
    </Flex>
  );
}

function Prediction({
  result,
  isPending,
  expected,
}: {
  result?: CalibrationPrediction;
  isPending: boolean;
  expected?: string;
}) {
  if (!result) {
    return isPending ? (
      <ProgressCircle isIndeterminate size="S" aria-label="Evaluating" />
    ) : (
      <Text color="text-500">{NO_VALUE}</Text>
    );
  }
  if (result.status === "error")
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Token
          color="var(--global-color-danger)"
          leadingVisual={<Icon svg={<Icons.AlertCircle />} />}
        >
          Error
        </Token>
        <DetailsPopover label="View error" icon={<Icons.Info />}>
          <Text size="S">{result.error}</Text>
        </DetailsPopover>
      </Flex>
    );
  const verdict =
    expected == null ? null : result.label === expected ? "match" : "mismatch";
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Token
        color={
          verdict === "match"
            ? "var(--global-color-success)"
            : verdict === "mismatch"
              ? "var(--global-color-danger)"
              : "var(--global-color-gray-600)"
        }
        leadingVisual={
          verdict === "match" ? (
            <Icon svg={<Icons.Checkmark />} />
          ) : verdict === "mismatch" ? (
            <Icon svg={<Icons.Close />} />
          ) : undefined
        }
      >
        {result.label}
      </Token>
      {result.explanation ? (
        <DetailsPopover label="View explanation" icon={<Icons.MessageCircle />}>
          <Text size="S">{result.explanation}</Text>
        </DetailsPopover>
      ) : null}
    </Flex>
  );
}

/** An icon button that opens its children in a popover. */
function DetailsPopover({
  label,
  icon,
  width = 400,
  children,
}: {
  label: string;
  icon: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <DialogTrigger>
      <IconButton size="S" aria-label={label}>
        <Icon svg={icon} />
      </IconButton>
      <Popover placement="bottom end">
        <Dialog style={{ width }}>
          <View padding="size-200" maxHeight="size-6000" overflow="auto">
            {children}
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
