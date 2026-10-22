import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Fragment, Suspense, useState, useSyncExternalStore } from "react";
import { graphql, useMutation } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import invariant from "tiny-invariant";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  EdgeFade,
  Flex,
  Heading,
  Icon,
  Icons,
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Skeleton,
  Text,
} from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import {
  GRIP_RESIZE_TARGET_MINIMUM_SIZE,
  GripResizeHandle,
} from "@phoenix/components/resize";
import { TableSkeleton } from "@phoenix/components/table";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type {
  InlineCodeEvaluatorInput,
  InlineLLMEvaluatorInput,
  ProjectEvaluatorTestBenchPreviewMutation,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestBenchPreviewMutation.graphql";
import {
  getRecordMappingDiagnostics,
  useEvaluatorMappingSourceBoundToRow,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { ProjectEvaluatorRecordInspector } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordInspector";
import { ProjectEvaluatorRecordTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordTable";
import {
  formatBulkTestLabel,
  formatRecordedRunSummary,
  getRecordedRunResultState,
  isRecordedRunEntryRunnable,
  type RecordedRun,
  type RecordedRunEntry,
  type RecordedRunRow,
  summarizeRecordedRuns,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorRecordKind,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorStore } from "@phoenix/store/evaluatorStore";
import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
} from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type ProjectEvaluatorInlineCode = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
};

/**
 * Labels read inside the sentence "12 spans matched in the …", so they are
 * lowercase phrases rather than titles.
 */
export const TIME_WINDOW_PRESETS = [
  { id: "1h", label: "last hour", ms: 3_600_000 },
  { id: "24h", label: "last 24 hours", ms: 86_400_000 },
  { id: "7d", label: "last 7 days", ms: 7 * 86_400_000 },
  { id: "30d", label: "last 30 days", ms: 30 * 86_400_000 },
] as const;

const isTimeWindowPresetId = (value: string): value is TimeWindowPresetId =>
  TIME_WINDOW_PRESETS.some(({ id }) => id === value);

export type TimeWindowPresetId = (typeof TIME_WINDOW_PRESETS)[number]["id"];

/**
 * `startIso` is computed once when the preset is chosen so re-renders do not
 * shift the window and refire the queries.
 */
export type TimeWindow = {
  presetId: TimeWindowPresetId;
  startIso: string;
};

export function makeTimeWindow(presetId: TimeWindowPresetId): TimeWindow {
  const preset = TIME_WINDOW_PRESETS.find(({ id }) => id === presetId);
  invariant(preset, `unknown time window preset: ${presetId}`);
  return {
    presetId,
    startIso: new Date(Date.now() - preset.ms).toISOString(),
  };
}

/** What the bench's header needs before and after the records load. */
export type TestBenchHeaderProps = {
  targetType: ProjectEvaluatorTarget;
  timeWindow: TimeWindow;
  onTimeWindowChange: (timeWindow: TimeWindow) => void;
  /**
   * The matched-count phrase, ending where the time window picker takes
   * over: "12 spans matched in the". It loads and suspends on its own.
   */
  countLine: ReactNode;
};

/**
 * The right pane of the project evaluator form: the records in scope, one
 * per row, with a docked inspector for the focused one. It answers three
 * questions before the evaluator is saved: what the scope catches, what the
 * evaluator receives from each record, and what it returns.
 *
 * The focused row is also the mapping source, so the input mapping on the
 * left is authored and diagnosed against a real context.
 */
export function ProjectEvaluatorTestBench({
  rows,
  recordKind,
  hasMore,
  isLoadingMore,
  onLoadMore,
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
  requiredVariables,
  ...headerProps
}: TestBenchHeaderProps & {
  rows: RecordedRunRow[];
  recordKind: ProjectEvaluatorRecordKind;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
}) {
  // `undefined` is no explicit choice yet (the newest row is focused); a key
  // that has since left the list falls back the same way.
  const [focusedKey, setFocusedKey] = useState<string | undefined>(undefined);
  const focusedRow =
    rows.find(({ key }) => key === focusedKey) ?? rows[0] ?? null;
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  useEvaluatorMappingSourceBoundToRow({
    recordKind,
    rowKey: focusedRow?.key ?? null,
    context: focusedRow?.context,
  });
  const { runs, runOnRow, isRunnable, runBlocker, currentFingerprint } =
    useEvaluatorPreviewRuns({
      codeEvaluatorId,
      inlineCode,
      playgroundStore,
    });
  const declaredVariables = useEvaluatorInputVariables();
  const entries: RecordedRunEntry[] = rows.map((row) => {
    const missingCount = getRecordMappingDiagnostics({
      context: row.context,
      inputMapping,
      declaredVariables,
      requiredVariables,
    }).filter(({ status }) => status === "missing").length;
    const run = runs[row.key];
    return {
      row,
      missingCount,
      run,
      resultState: getRecordedRunResultState({
        run,
        missingCount,
        isUnavailable: row.unavailableReason != null,
        currentFingerprint,
      }),
    };
  });
  // The bulk test runs what a row's own button could: a record the server
  // built no context for, or whose mapping binds nothing, is left out. One
  // row at a time is a click on that row's own button.
  const runnableEntries = entries.filter(isRecordedRunEntryRunnable);
  const isRetest =
    runnableEntries.length > 0 &&
    runnableEntries.every(({ run }) => run != null);
  const summary = summarizeRecordedRuns(entries);
  const hasAnyRun = entries.some(({ run }) => run != null);
  const focusedEntry =
    entries.find(({ row }) => row.key === focusedRow?.key) ?? null;
  return (
    <div css={benchCSS} data-testid="project-evaluator-test-bench">
      <TestBenchHeader
        {...headerProps}
        summaryParts={[
          hasMore ? `showing the ${rows.length} most recent` : null,
          hasAnyRun ? formatRecordedRunSummary(summary) : null,
          "previews are not saved to the project",
        ]}
        blocker={runBlocker}
      >
        <Button
          size="S"
          leadingVisual={
            <Icon svg={isRetest ? <Icons.Refresh /> : <Icons.Play />} />
          }
          isDisabled={!isRunnable || runnableEntries.length === 0}
          onPress={() => {
            for (const { row } of runnableEntries) {
              runOnRow(row);
            }
          }}
        >
          {formatBulkTestLabel({
            runnableCount: runnableEntries.length,
            totalCount: entries.length,
            isRetest,
          })}
        </Button>
      </TestBenchHeader>
      <Group
        orientation="vertical"
        className="test-bench__split"
        resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
      >
        <Panel
          id="project-evaluator-records"
          defaultSize="55%"
          minSize={RECORDS_PANEL_MIN_SIZE}
          className="test-bench__panel"
        >
          <ProjectEvaluatorRecordTable
            entries={entries}
            recordKind={recordKind}
            focusedRowKey={focusedRow?.key ?? null}
            onFocusRow={setFocusedKey}
            isRunnable={isRunnable}
            runBlocker={runBlocker}
            onRunRow={runOnRow}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </Panel>
        <GripResizeHandle />
        <Panel
          id="project-evaluator-inspector"
          minSize={INSPECTOR_PANEL_MIN_SIZE}
          className="test-bench__panel"
        >
          {focusedEntry ? (
            <ProjectEvaluatorRecordInspector
              entry={focusedEntry}
              recordKind={recordKind}
              inputMapping={inputMapping}
              requiredVariables={requiredVariables}
              isRunnable={isRunnable}
              runBlocker={runBlocker}
              onRun={() => runOnRow(focusedEntry.row)}
            />
          ) : null}
        </Panel>
      </Group>
    </div>
  );
}

/** The bench while its records load: the same header, and a disabled test button. */
export function ProjectEvaluatorTestBenchFallback({
  targetType,
  ...headerProps
}: TestBenchHeaderProps) {
  const records = formatEvaluationTargetPlural(targetType);
  return (
    <div css={benchCSS}>
      <TestBenchHeader
        targetType={targetType}
        {...headerProps}
        summaryParts={[]}
        blocker={null}
      >
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.Play />} />}
          isDisabled
        >
          Test all
        </Button>
      </TestBenchHeader>
      <div
        className="test-bench__loading"
        role="status"
        aria-label={`Loading ${records}`}
      >
        <div className="test-bench__loading-records">
          <TableSkeleton rowCount="fill" aria-hidden />
        </div>
        <EdgeFade edge="bottom" className="test-bench__loading-inspector">
          <Skeleton height="100%" borderRadius="medium" aria-hidden />
        </EdgeFade>
      </div>
    </div>
  );
}

/**
 * The title row, then one line that says everything about the list: how many
 * records the scope matches, over which window, how many are listed, how the
 * tests stand, and that nothing here is saved. Anything that stops a test
 * from starting sits on its own line, in the warning colour, because it is
 * the one sentence the author has to act on.
 */
function TestBenchHeader({
  targetType,
  timeWindow,
  onTimeWindowChange,
  countLine,
  summaryParts,
  blocker,
  children,
}: TestBenchHeaderProps & {
  summaryParts: readonly (string | null)[];
  blocker: string | null;
  children: ReactNode;
}) {
  const records = formatEvaluationTargetPlural(targetType);
  return (
    <div className="test-bench__header">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
        wrap
      >
        <Heading level={2} weight="heavy">
          {capitalize(records)} in scope
        </Heading>
        {children}
      </Flex>
      <Text size="S" color="text-500">
        <span className="test-bench__summary">
          <Suspense fallback={<>Counting matching {records} in the</>}>
            {countLine}
          </Suspense>{" "}
          <TimeWindowSelect
            value={timeWindow.presetId}
            onChange={onTimeWindowChange}
          />
          {summaryParts
            .filter((part) => part != null)
            .map((part) => (
              <Fragment key={part}> · {part}</Fragment>
            ))}
        </span>
      </Text>
      {blocker ? (
        <div className="test-bench__blocker" role="status">
          <Icon svg={<Icons.AlertTriangle />} color="warning" />
          <Text size="S" color="warning">
            {blocker}.
          </Text>
        </div>
      ) : null}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The preview window, as a word in the count sentence rather than a control
 * beside the test button: it changes what the bench lists, never what the
 * evaluator is saved with, and the project page behind the dialog already
 * has a time picker that means something else.
 */
function TimeWindowSelect({
  value,
  onChange,
}: {
  value: TimeWindowPresetId;
  onChange: (timeWindow: TimeWindow) => void;
}) {
  return (
    <Select
      aria-label="Preview window"
      size="S"
      css={inlineSelectCSS}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (typeof key === "string" && isTimeWindowPresetId(key)) {
          onChange(makeTimeWindow(key));
        }
      }}
    >
      <Button variant="quiet" size="S">
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

/**
 * Floors in pixels for the split under the bench header: the table keeps its
 * header and two rows, the inspector its header and the first input, however
 * short the screen.
 */
const RECORDS_PANEL_MIN_SIZE = "160px";
const INSPECTOR_PANEL_MIN_SIZE = "200px";

const inlineSelectCSS = css`
  display: inline-flex;
  vertical-align: baseline;
  width: auto;
  // Sits inside a sentence of S text: no field chrome, no extra height.
  button {
    min-height: 0;
    height: auto;
    padding: 0 var(--global-dimension-size-25);
    font-size: inherit;
    line-height: inherit;
    font-weight: 600;
    color: var(--global-text-color-700);
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }
`;

const benchCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  .test-bench__header {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
    padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-100);
  }
  .test-bench__summary {
    display: inline;
    line-height: var(--global-line-height-m);
  }
  .test-bench__blocker {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
  .test-bench__split {
    flex: 1 1 auto;
    min-height: 0;
    border-top: 1px solid var(--global-border-color-default);
  }
  .test-bench__panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    // The resizable panel scrolls if its content outgrows it; like the
    // regions inside it, it neither bounces nor chains out to the dialog.
    overscroll-behavior: none;
  }
  .test-bench__loading {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .test-bench__loading-records {
    flex: 0 0 55%;
    min-height: ${RECORDS_PANEL_MIN_SIZE};
    display: flex;
    flex-direction: column;
  }
  .test-bench__loading-inspector {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--global-dimension-size-200);
  }
`;

type PreviewEvaluatorInput =
  | { codeEvaluatorId: string }
  | { inlineCodeEvaluator: InlineCodeEvaluatorInput }
  | { inlineLlmEvaluator: InlineLLMEvaluatorInput };

/**
 * Stands in for the evaluator's name until the author types one. The name
 * doubles as the annotation's, so a test needs some name, but an unnamed
 * draft is not a reason to keep the author from seeing what it returns:
 * the name is only checked when the evaluator is saved.
 */
export const UNTITLED_EVALUATOR_NAME = "untitled-evaluator";

/** The definition with the stand-in name filled in wherever a name is blank. */
function withPreviewName(
  state: Pick<EvaluatorStore, "evaluator" | "outputConfigs">
): { name: string; outputConfigs: EvaluatorStore["outputConfigs"] } {
  const name = state.evaluator.globalName.trim() || UNTITLED_EVALUATOR_NAME;
  return {
    name,
    outputConfigs: state.outputConfigs.map((config) =>
      config.name.trim() ? config : { ...config, name }
    ),
  };
}

/**
 * The evaluator the preview mutation runs, built the same way at render time
 * for the fingerprint and at click time for the request, so a run's
 * fingerprint and the bench's current one can only differ when the
 * definition did.
 */
function buildPreviewEvaluator({
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
  state,
}: {
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  state: Pick<EvaluatorStore, "evaluator" | "outputConfigs">;
}): PreviewEvaluatorInput | null {
  if (codeEvaluatorId) {
    return { codeEvaluatorId };
  }
  const { name, outputConfigs } = withPreviewName(state);
  if (inlineCode) {
    return {
      inlineCodeEvaluator: {
        name,
        language: inlineCode.language,
        sourceCode: inlineCode.sourceCode,
        outputConfigs: buildOutputConfigsInput(outputConfigs),
        sandboxConfigId: inlineCode.sandboxConfigId,
        description: state.evaluator.description || null,
      },
    };
  }
  const instanceId = playgroundStore?.getState().instances[0]?.id;
  if (playgroundStore == null || instanceId == null) {
    return null;
  }
  const payload = createLLMEvaluatorPayload({
    playgroundStore,
    instanceId,
    name,
    description: state.evaluator.description,
    outputConfigs,
    inputMapping: state.evaluator.inputMapping,
    includeExplanation: state.evaluator.includeExplanation,
    datasetId: "",
  });
  return {
    inlineLlmEvaluator: {
      name: payload.name,
      description: payload.description,
      outputConfigs: payload.outputConfigs,
      promptVersion: payload.promptVersion,
    },
  };
}

function fingerprintDefinition(
  evaluator: PreviewEvaluatorInput | null,
  inputMapping: EvaluatorInputMapping
): string {
  return JSON.stringify({ evaluator, inputMapping });
}

const subscribeToNothing = () => () => {};

/** The preview runs, keyed by row; results survive a load-more. */
function useEvaluatorPreviewRuns({
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
}: {
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
}) {
  // The fingerprint reads the playground store at render, which the compiler
  // cannot see through; left unmemoized, every render recomputes it from
  // whatever the stores hold now.
  "use no memo";
  const evaluatorStore = useEvaluatorStoreInstance();
  const credentials = useCredentialsContext((state) => state);
  const [runs, setRuns] = useState<Record<string, RecordedRun>>({});
  const [previewEvaluator] =
    useMutation<ProjectEvaluatorTestBenchPreviewMutation>(graphql`
      mutation ProjectEvaluatorTestBenchPreviewMutation(
        $input: EvaluatorPreviewsInput!
      ) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            annotation {
              name
              label
              score
              explanation
            }
            error
          }
        }
      }
    `);
  // Subscribed so an edit to the prompt, model, mapping, or annotation config
  // re-renders the bench and the fingerprint below moves with it.
  const definitionState = useEvaluatorStore(
    useShallow((state) => ({
      evaluator: state.evaluator,
      outputConfigs: state.outputConfigs,
    }))
  );
  useSyncExternalStore(
    playgroundStore?.subscribe ?? subscribeToNothing,
    () => playgroundStore?.getState().instances
  );
  const currentFingerprint = fingerprintDefinition(
    buildPreviewEvaluator({
      codeEvaluatorId,
      inlineCode,
      playgroundStore,
      state: definitionState,
    }),
    definitionState.evaluator.inputMapping
  );
  // Checked with the stand-in name in place: a blank name is not what stops
  // a test, only a configuration that would fail on the server.
  const outputConfigErrors =
    codeEvaluatorId != null || inlineCode != null
      ? []
      : getOutputConfigValidationErrors(
          withPreviewName(definitionState).outputConfigs
        );
  const isRunnable = outputConfigErrors.length === 0;
  const runBlocker = isRunnable
    ? null
    : "Fix the evaluator's annotation configuration to test";

  const runOnRow = (row: RecordedRunRow) => {
    const state = evaluatorStore.getState();
    const evaluator = buildPreviewEvaluator({
      codeEvaluatorId,
      inlineCode,
      playgroundStore,
      state,
    });
    invariant(evaluator, "a playground instance is required");
    const fingerprint = fingerprintDefinition(
      evaluator,
      state.evaluator.inputMapping
    );
    const rowKey = row.key;
    setRuns((current) => {
      const previous = current[rowKey];
      return {
        ...current,
        [rowKey]: {
          status: "running",
          fingerprint,
          previous:
            previous?.status === "running" ? previous.previous : previous,
        },
      };
    });
    previewEvaluator({
      variables: {
        input: {
          previews: [
            {
              context: row.context,
              evaluator,
              inputMapping: state.evaluator.inputMapping,
              applyOnlineEvaluationLimits: true,
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted(response, errors) {
        if (errors?.length) {
          setRuns((current) => ({
            ...current,
            [rowKey]: {
              status: "error",
              fingerprint,
              message: errors.map(({ message }) => message).join("\n"),
            },
          }));
          return;
        }
        setRuns((current) => ({
          ...current,
          [rowKey]: {
            status: "done",
            fingerprint,
            results: [...response.evaluatorPreviews.results],
          },
        }));
      },
      onError(mutationError) {
        setRuns((current) => ({
          ...current,
          [rowKey]: {
            status: "error",
            fingerprint,
            message:
              getErrorMessagesFromRelayMutationError(mutationError)?.join(
                "\n"
              ) ?? mutationError.message,
          },
        }));
      },
    });
  };

  return { runs, runOnRow, isRunnable, runBlocker, currentFingerprint };
}
