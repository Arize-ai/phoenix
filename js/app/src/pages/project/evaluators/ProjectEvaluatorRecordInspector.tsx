import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Alert,
  Button,
  ExternalLink,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  Token,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { AnnotationPreviewPopoverButton } from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { EvaluatorInputsView } from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { getRowTestBlocker } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordTable";
import {
  type RecordedRunEntry,
  type RecordedRunResult,
  type RecordedRunResultState,
  shortenRecordId,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  formatElapsedShort,
  type ProjectEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorInputMapping } from "@phoenix/types";

/**
 * Where each evaluator variable is read from, in the record's own words. The
 * trace and session bindings have no span vocabulary to borrow, so they are
 * spelled out here rather than in a standalone note above the table.
 */
const INPUTS_DESCRIPTION: Record<ProjectEvaluatorRecordKind, ReactNode> = {
  span: "What the evaluator receives from this span.",
  trace: (
    <>
      The root span&apos;s input as <code>input</code>, its output as{" "}
      <code>output</code>, and its attributes under{" "}
      <code>metadata.attributes</code>.
    </>
  ),
  session: (
    <>
      The session&apos;s first input as <code>input</code>, its last output as{" "}
      <code>output</code>, and every turn under <code>metadata.turns</code>.
    </>
  ),
};

/**
 * The docked detail of the focused record: what the evaluator returned for
 * it, and what each variable resolved to. It sits in a fixed region so
 * arrowing through records reads each in the same place. The Test button
 * lives with the result it produces, under the Result title, so the control
 * and its outcome are read together here as they are in the table.
 */
export function ProjectEvaluatorRecordInspector({
  entry,
  recordKind,
  inputMapping,
  requiredVariables,
  isRunnable,
  runBlocker,
  onRun,
}: {
  entry: RecordedRunEntry;
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
  isRunnable: boolean;
  /** Why nothing can run right now, shown on the disabled Test button. */
  runBlocker: string | null;
  onRun: () => void;
}) {
  const { row, run, resultState } = entry;
  const hasResult = run != null && run.status !== "running";
  const testBlocker = getRowTestBlocker({
    entry,
    recordKind,
    isRunnable,
    runBlocker,
  });
  return (
    <section
      css={inspectorCSS}
      aria-label={`Selected ${recordKind}`}
      data-testid="project-evaluator-record-inspector"
    >
      <header className="record-inspector__header">
        <Flex
          direction="row"
          alignItems="center"
          gap="size-100"
          minWidth={0}
          flex="1 1 auto"
        >
          {/* The pane's title already names the record kind; a span's own
              kind token says more than repeating "span" beside it. */}
          {row.spanKind ? (
            <SpanKindToken spanKind={row.spanKind} size="S" />
          ) : (
            <Token size="S">{recordKind}</Token>
          )}
          <span className="record-inspector__name" title={row.name}>
            {row.name}
          </span>
          <span className="record-inspector__meta">
            {row.isSample ? (
              <Token size="S">Sample</Token>
            ) : (
              <>
                {/* A session is named by its id; repeating it says nothing. */}
                {row.recordId !== row.name ? (
                  <code title={row.recordId}>
                    {shortenRecordId(row.recordId)}
                  </code>
                ) : null}
                {row.startTime ? (
                  <span>{formatElapsedShort(row.startTime)} ago</span>
                ) : null}
                {row.latencyMs != null ? (
                  <LatencyText latencyMs={row.latencyMs} size="XS" />
                ) : null}
              </>
            )}
          </span>
        </Flex>
        {row.href ? (
          <ExternalLink href={row.href}>Open {recordKind}</ExternalLink>
        ) : null}
      </header>
      <div className="record-inspector__body">
        {row.unavailableReason ? (
          <Alert variant="warning" title="No evaluation context">
            {row.unavailableReason}
          </Alert>
        ) : (
          <div className="record-inspector__sections">
            <section className="record-inspector__result" aria-label="Result">
              <div className="record-inspector__section-header">
                <InspectorSectionTitle title="Result" />
                <TestButton
                  recordKind={recordKind}
                  isRunning={resultState.kind === "running"}
                  isRetest={hasResult}
                  blocker={testBlocker}
                  onRun={onRun}
                />
              </div>
              <RecordedRunDetail entry={entry} />
            </section>
            <EvaluatorInputsView
              heading={
                <InspectorSectionTitle
                  title="Evaluator inputs"
                  description={INPUTS_DESCRIPTION[recordKind]}
                />
              }
              context={row.context}
              recordKind={recordKind}
              inputMapping={inputMapping}
              requiredVariables={requiredVariables}
              isSampleContext={row.isSample}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The inspector's Test button, beside the result it produces: the one
 * obvious way to run the record being read.
 */
function TestButton({
  recordKind,
  isRunning,
  isRetest,
  blocker,
  onRun,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  isRunning: boolean;
  isRetest: boolean;
  blocker: string | null;
  onRun: () => void;
}) {
  const button = (
    <Button
      size="S"
      variant="primary"
      leadingVisual={
        <Icon svg={isRetest ? <Icons.Refresh /> : <Icons.Play />} />
      }
      isDisabled={blocker != null || isRunning}
      onPress={onRun}
    >
      {isRunning ? "Testing…" : isRetest ? "Re-test" : "Test"}
    </Button>
  );
  if (blocker == null) {
    return button;
  }
  return (
    <TooltipTrigger delay={300}>
      <TriggerWrap>{button}</TriggerWrap>
      <Tooltip placement="bottom">
        <TooltipArrow />
        {blocker}. Nothing runs on this {recordKind} until then.
      </Tooltip>
    </TooltipTrigger>
  );
}

function InspectorSectionTitle({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <Flex direction="row" alignItems="baseline" gap="size-100" wrap>
      <Heading level={3} className="record-inspector__section-title">
        {title}
      </Heading>
      {description ? (
        <Text size="XS" color="text-500">
          {description}
        </Text>
      ) : null}
    </Flex>
  );
}

/**
 * The run's outcome: the verdict chip with its explanation, a spinner while
 * a test is in flight, and a line before the first run. A stale outcome is
 * still shown, under a note that says what it is.
 */
function RecordedRunDetail({ entry }: { entry: RecordedRunEntry }) {
  const { run, resultState } = entry;
  if (run == null || resultState.kind === "idle") {
    return (
      <Text size="S" color="text-500">
        Not tested yet.
      </Text>
    );
  }
  if (run.status === "running") {
    return (
      <Flex direction="row" alignItems="center" gap="size-100">
        <ProgressCircle isIndeterminate size="S" aria-label="Testing" />
        <Text size="S" color="text-500">
          Testing…
        </Text>
      </Flex>
    );
  }
  const staleNote = isStaleState(resultState) ? (
    <Text size="XS" color="text-500">
      From an earlier version of the evaluator. Re-test to refresh it.
    </Text>
  ) : null;
  if (run.status === "error") {
    return (
      <Flex direction="column" gap="size-100">
        {staleNote}
        <Alert variant="danger" title="Evaluator Error">
          {run.message}
        </Alert>
      </Flex>
    );
  }
  return (
    <Flex direction="column" gap="size-100">
      {staleNote}
      <div data-stale={isStaleState(resultState)} css={staleCSS}>
        {run.results.map((result, index) =>
          result.error ? (
            <Alert
              key={index}
              variant="danger"
              title={`Evaluator Error: ${result.evaluatorName}`}
            >
              {result.error}
            </Alert>
          ) : result.annotation ? (
            <RecordedRunVerdict key={index} annotation={result.annotation} />
          ) : null
        )}
      </div>
    </Flex>
  );
}

function isStaleState(state: RecordedRunResultState): boolean {
  return (
    (state.kind === "annotated" || state.kind === "failed") && state.isStale
  );
}

/**
 * One verdict: the chip the Result column shows, which already carries the
 * label and score, and the explanation under it. The same chip opens the
 * annotation's full details.
 */
function RecordedRunVerdict({
  annotation,
}: {
  annotation: NonNullable<RecordedRunResult["annotation"]>;
}) {
  return (
    <div css={verdictCSS}>
      <Flex direction="row" alignItems="center" gap="size-150" wrap>
        <AnnotationPreviewPopoverButton annotation={annotation} compact />
      </Flex>
      {annotation.explanation ? (
        <p className="record-verdict__explanation">{annotation.explanation}</p>
      ) : null}
    </div>
  );
}

const staleCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  &[data-stale="true"] {
    opacity: 0.6;
  }
`;

const verdictCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  .record-verdict__explanation {
    margin: 0;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-700);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;

/** Past this inspector width the result and the inputs sit side by side. */
const TWO_COLUMN_MIN_WIDTH = "900px";

const inspectorCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  .record-inspector__header {
    flex: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-200);
    // The same height as the table header above it so the two bands line up,
    // but a plain band: painted like a table header it reads as a second grid.
    box-sizing: border-box;
    min-height: var(--global-table-header-height);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-200);
    border-bottom: 1px solid var(--global-border-color-default);
    font-size: var(--global-font-size-s);
    a {
      flex: none;
      white-space: nowrap;
    }
  }
  .record-inspector__name {
    font-weight: 600;
    color: var(--global-text-color-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .record-inspector__meta {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    flex: none;
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    code {
      font-family: var(--global-font-family-code, monospace);
    }
  }
  .record-inspector__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200)
      var(--global-dimension-size-200);
    // The layout below answers to the inspector's own width, not the
    // viewport's: the dialog's panes are resizable.
    container-type: inline-size;
  }
  .record-inspector__sections {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-300);
  }
  @container (min-width: ${TWO_COLUMN_MIN_WIDTH}) {
    .record-inspector__sections {
      display: grid;
      grid-template-columns: minmax(280px, 2fr) minmax(0, 3fr);
      align-items: start;
      gap: var(--global-dimension-size-400);
    }
  }
  .record-inspector__result {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .record-inspector__section-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-200);
    // The inputs section's header holds a size-S toolbar; this one matches
    // its height so the two titles sit on one line in the two-column layout.
    min-height: var(--global-button-height-s);
  }
  // The same register as the table header above: one heading style for the
  // dense half of the dialog rather than a third one.
  .record-inspector__section-title {
    margin: 0;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    font-weight: 600;
    color: var(--global-text-color-900);
  }
`;
