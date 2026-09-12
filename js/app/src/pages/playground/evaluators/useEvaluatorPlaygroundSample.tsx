import { useEffect, useRef, useState } from "react";

import { makeTimeWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorTimeWindow";
import type { TimeWindowPresetId } from "@phoenix/pages/project/evaluators/projectEvaluatorTimeWindow";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";

import { EvaluatorPlaygroundProjectSample } from "./EvaluatorPlaygroundProjectSample";
import { EvaluatorPlaygroundSample } from "./EvaluatorPlaygroundSample";
import type {
  EvaluatorPlaygroundSource,
  EvaluatorPlaygroundSourceKind,
} from "./evaluatorPlaygroundSource";
import type { SampleExample } from "./evaluatorResults";
import { createEvaluatorContext } from "./evaluatorResults";
import type { EvaluatorSlotSampleContext } from "./evaluatorSlotTypes";
import type { LatestSample } from "./useEvaluatorPlaygroundExpectedOutputs";

const EMPTY_EXAMPLES: SampleExample[] = [];

/**
 * The page's sample: which rows are loaded for the source, keyed so a scope
 * change refetches, with the first row as the slots' mapping source.
 */
export function useEvaluatorPlaygroundSample({
  source,
  sourceKind,
  windowPreset,
  sampleSize,
}: {
  source: EvaluatorPlaygroundSource | null;
  sourceKind: EvaluatorPlaygroundSourceKind;
  windowPreset: TimeWindowPresetId;
  sampleSize: number;
}) {
  const [sampleGeneration, setSampleGeneration] = useState(0);

  // The window's start is fixed when the preset is chosen (or the sample
  // reloaded) so re-renders do not shift it and refetch. A dataset ignores it.
  const [timeWindow, setTimeWindow] = useState(() =>
    makeTimeWindow(windowPreset)
  );

  if (timeWindow.presetId !== windowPreset)
    setTimeWindow(makeTimeWindow(windowPreset));

  const sampleScope = JSON.stringify([
    sampleGeneration,
    source,
    timeWindow.startIso,
  ]);

  const sampleKey = JSON.stringify([sampleScope, sampleSize]);
  const [sample, setSample] = useState<LoadedSample | null>(null);

  const { isSampleLoading, displayedExamples, examples } = getSampleState({
    source,
    sample,
    sampleKey,
    sampleScope,
  });

  // Annotations are written in batches (see expectedOutputQueue). The flush reads
  // the sample through this ref so a timer firing later still resolves each
  // row's current revision or annotation ids, not the ones it had when annotated.
  const latestSample = useRef<LatestSample>({
    source,
    rows: displayedExamples,
  });
  useEffect(() => {
    latestSample.current = { source, rows: displayedExamples };
  });

  return {
    sampleKey,
    isSampleLoading,
    isSampleLoaded: sample?.key === sampleKey,
    displayedExamples,
    examples,
    sampleContext: getSampleContext(sourceKind, displayedExamples),
    timeWindow,
    getLatest: () => latestSample.current,
    onLoad: (loaded: SampleExample[]) =>
      setSample({ key: sampleKey, scope: sampleScope, examples: loaded }),
    updateRows: (update: (rows: SampleExample[]) => SampleExample[]) =>
      setSample((previous) =>
        previous
          ? { ...previous, examples: update(previous.examples) }
          : previous
      ),
    /** Loads the sample again, moving a project's window up to now. */
    reload: () => {
      setTimeWindow(makeTimeWindow(windowPreset));
      setSampleGeneration((generation) => generation + 1);
    },
  };
}

type LoadedSample = {
  key: string;
  scope: string;
  examples: SampleExample[];
};

/**
 * Keep the displayed sample mounted while a size change loads. Execution and
 * review still require the requested sample, and a different source must
 * never display rows from the previous scope.
 */
function getSampleState({
  source,
  sample,
  sampleKey,
  sampleScope,
}: {
  source: EvaluatorPlaygroundSource | null;
  sample: LoadedSample | null;
  sampleKey: string;
  sampleScope: string;
}) {
  const isSampleLoading = source != null && sample?.key !== sampleKey;

  const displayedExamples =
    sample?.scope === sampleScope ? sample.examples : EMPTY_EXAMPLES;

  return {
    isSampleLoading,
    displayedExamples,
    examples: isSampleLoading ? EMPTY_EXAMPLES : displayedExamples,
  };
}

/** Loads the sample for whichever kind of source is selected. */
export function EvaluatorPlaygroundSampleLoader({
  source,
  sampleKey,
  sampleSize,
  startIso,
  onLoad,
}: {
  source: EvaluatorPlaygroundSource;
  sampleKey: string;
  sampleSize: number;
  startIso: string;
  onLoad: (rows: SampleExample[]) => void;
}) {
  return source.kind === "dataset" ? (
    <EvaluatorPlaygroundSample
      fetchKey={sampleKey}
      datasetId={source.datasetId}
      first={sampleSize}
      splitIds={source.splitIds}
      versionId={source.versionId}
      onLoad={onLoad}
    />
  ) : (
    <EvaluatorPlaygroundProjectSample
      fetchKey={sampleKey}
      projectId={source.projectId}
      first={sampleSize}
      filterCondition={source.filterCondition}
      startIso={startIso}
      onLoad={onLoad}
    />
  );
}

/**
 * The first row as the slots' mapping source, in the source's grain. An empty
 * project sample falls back to the sample span the scope panel previews
 * against, so the mapping UI still speaks span vocabulary.
 */
function getSampleContext(
  kind: EvaluatorPlaygroundSourceKind,
  rows: SampleExample[]
): EvaluatorSlotSampleContext {
  if (rows[0])
    return {
      grain: kind === "project" ? "span" : "dataset",
      ...createEvaluatorContext(rows[0]),
    };

  if (kind === "project")
    return {
      grain: "span",
      ...createEvaluatorContext(getSampleSpanEvaluationContext().context),
    };

  return {
    grain: "dataset",
    input: {},
    output: {},
    reference: {},
    metadata: {},
  };
}
