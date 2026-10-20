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
import { AnnotationPreviewPopoverButton } from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { EvaluatorInputsView } from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { getRowTestBlocker } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordTable";
import {
  type RecordedRunEntry,
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

const CONTEXT_TITLE: Record<ProjectEvaluatorRecordKind, string> = {
  span: "Span data",
  trace: "Trace data",
  session: "Session data",
};

/**
 * The docked detail of the focused record: what each variable resolved to,
 * and the record's data to map from. It sits in a fixed region so arrowing
 * through records reads each in the same place. The verdict is not repeated
 * here: the record's row above already carries it with its explanation, the
 * way a span carries its name and excerpt. The header keeps the record's own
 * Test button, so the record being read can be run without finding its row.
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
        <div className="record-inspector__actions">
          <LastTestResult entry={entry} />
          <TestButton
            recordKind={recordKind}
            isRunning={resultState.kind === "running"}
            isRetest={hasResult}
            blocker={testBlocker}
            onRun={onRun}
          />
          {row.href ? (
            <ExternalLink href={row.href}>Open {recordKind}</ExternalLink>
          ) : null}
        </div>
      </header>
      <div className="record-inspector__body">
        {row.unavailableReason ? (
          <Alert variant="warning" title="No evaluation context">
            {row.unavailableReason}
          </Alert>
        ) : (
          <div className="record-inspector__sections">
            <EvaluatorInputsView
              heading={
                <InspectorSectionTitle
                  title="Evaluator inputs"
                  description={INPUTS_DESCRIPTION[recordKind]}
                />
              }
              contextHeading={
                <InspectorSectionTitle
                  title={CONTEXT_TITLE[recordKind]}
                  description="Every key is a path a variable can be mapped to."
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
 * The inspector's Test button, in its header beside the record it runs: the
 * one obvious way to run the record being read.
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

/**
 * What the last test of this record said, beside the button that runs it,
 * so a test started from here shows its outcome here too. It mirrors the
 * row's Result cell: the verdict chip, or an error with its message on
 * hover; nothing before the first test or while one is running.
 */
function LastTestResult({ entry }: { entry: RecordedRunEntry }) {
  const { resultState: state } = entry;
  if (state.kind !== "annotated" && state.kind !== "failed") {
    return null;
  }
  return (
    <div
      className="record-inspector__last-result"
      data-stale={state.isStale}
      aria-label="Last test result"
    >
      <span className="record-inspector__last-result-label">
        <Text size="XS" color="text-500">
          {state.isStale ? "Last result (stale)" : "Last result"}
        </Text>
      </span>
      {state.kind === "annotated" ? (
        state.annotations.map((annotation, index) => (
          <span key={index} className="record-inspector__last-result-chip">
            <AnnotationPreviewPopoverButton annotation={annotation} compact />
          </span>
        ))
      ) : (
        <TooltipTrigger delay={300}>
          <TriggerWrap>
            <Text size="S" color="danger">
              Error
            </Text>
          </TriggerWrap>
          <Tooltip placement="bottom">
            <TooltipArrow />
            {state.message}
          </Tooltip>
        </TooltipTrigger>
      )}
    </div>
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
    // Where the header is short of room, which it answers to rather than the
    // viewport, the record's id, age, and latency drop out before anything
    // in the last result segment does: the inspector exists to read that.
    container-type: inline-size;
    a {
      flex: none;
      white-space: nowrap;
    }
  }
  // Where the header runs short the record's details give way first, then
  // its name down to a few characters; the actions keep their size.
  .record-inspector__name {
    flex: 0 1 auto;
    min-width: var(--global-dimension-size-800);
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
    flex: 0 1000 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
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
    // No bounce at the ends, and no scroll chaining out to the dialog.
    overscroll-behavior: none;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200)
      var(--global-dimension-size-200);
  }
  .record-inspector__sections {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-300);
  }
  // A segment of its own, set off from the record's name by a rule.
  .record-inspector__last-result {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-75);
    min-width: 0;
    padding-inline-start: var(--global-dimension-size-200);
    border-inline-start: 1px solid var(--global-border-color-default);
    align-self: stretch;
    &[data-stale="true"] .record-inspector__last-result-chip {
      opacity: 0.5;
    }
  }
  @container (max-width: 760px) {
    .record-inspector__meta {
      display: none;
    }
  }
  .record-inspector__last-result-chip {
    display: flex;
    min-width: 0;
    overflow: hidden;
  }
  .record-inspector__actions {
    flex: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-200);
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
