import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

const DEFAULT_SESSION_URL =
  "http://app.flat-drawer-compare.phoenix.localhost/projects/UHJvamVjdDoz/sessions/UHJvamVjdFNlc3Npb246Ng%3D%3D?timeRangeKey=7d&sessionView=traces&selectedTraceId=7b19e908eb720d732ee224ec5eaf19dc";
const DEFAULT_WARM_RUNS = 15;
const DEFAULT_COLD_RUNS = 3;
const DEFAULT_CPU_THROTTLE = 1;
const VIEWPORT = { width: 1440, height: 1000 };

const SPANS = {
  faster: "U3Bhbjo2NDE=",
  heavier: "U3Bhbjo2Mzk=",
} as const;

type SpanLabel = keyof typeof SPANS;
type BenchmarkScenario = "cold" | "warm";

type BenchmarkConfig = {
  coldRuns: number;
  cpuThrottle: number;
  outputDirectory: string;
  sessionUrl: string;
  warmRuns: number;
};

type BrowserMeasurement = {
  bodyObservedMs: number | null;
  bodyPaintMs: number | null;
  domNodesAfter: number | null;
  domNodesBefore: number;
  graphQlEncodedBodyBytes: number;
  graphQlRequestCount: number;
  graphQlTransferBytes: number;
  heapAfterBytes: number | null;
  heapBeforeBytes: number | null;
  longestLongTaskMs: number;
  longTaskCount: number;
  mountedLlmMessagesAfter: number;
  routeObservedMs: number | null;
  routePaintMs: number | null;
  selectionObservedMs: number | null;
  selectionPaintMs: number | null;
  skeletonObservedMs: number | null;
  skeletonPaintMs: number | null;
  targetSpanNodeId: string;
  totalLongTaskMs: number;
};

type BenchmarkSample = BrowserMeasurement & {
  direction: string;
  run: number;
  scenario: BenchmarkScenario;
  target: SpanLabel;
};

type MetricSummary = {
  maximum: number;
  mean: number;
  median: number;
  minimum: number;
  p90: number;
};

type GroupSummary = {
  count: number;
  direction: string;
  metrics: Partial<Record<NumericMetric, MetricSummary>>;
  scenario: BenchmarkScenario;
  target: SpanLabel;
};

const NUMERIC_METRICS = [
  "selectionObservedMs",
  "selectionPaintMs",
  "skeletonObservedMs",
  "skeletonPaintMs",
  "bodyObservedMs",
  "bodyPaintMs",
  "longTaskCount",
  "mountedLlmMessagesAfter",
  "routeObservedMs",
  "routePaintMs",
  "totalLongTaskMs",
  "longestLongTaskMs",
  "graphQlRequestCount",
  "graphQlTransferBytes",
  "graphQlEncodedBodyBytes",
  "domNodesBefore",
  "domNodesAfter",
  "heapBeforeBytes",
  "heapAfterBytes",
] as const satisfies readonly (keyof BrowserMeasurement)[];

type NumericMetric = (typeof NUMERIC_METRICS)[number];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");

function parsePositiveNumber({
  flag,
  value,
}: {
  flag: string;
  value: string | undefined;
}) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsedValue;
}

function parseArguments(args: string[]): BenchmarkConfig {
  const config: BenchmarkConfig = {
    coldRuns: DEFAULT_COLD_RUNS,
    cpuThrottle: DEFAULT_CPU_THROTTLE,
    outputDirectory: resolve(
      repositoryRoot,
      "artifacts/span-details-performance/baseline"
    ),
    sessionUrl: DEFAULT_SESSION_URL,
    warmRuns: DEFAULT_WARM_RUNS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    switch (flag) {
      case "--cold-runs":
        config.coldRuns = parsePositiveNumber({ flag, value });
        index += 1;
        break;
      case "--cpu-throttle":
        config.cpuThrottle = parsePositiveNumber({ flag, value });
        index += 1;
        break;
      case "--output":
        if (!value) throw new Error("--output requires a directory");
        config.outputDirectory = resolve(repositoryRoot, value);
        index += 1;
        break;
      case "--session-url":
        if (!value) throw new Error("--session-url requires a URL");
        config.sessionUrl = value;
        index += 1;
        break;
      case "--warm-runs":
        config.warmRuns = parsePositiveNumber({ flag, value });
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return config;
}

function getSpanUrl({
  sessionUrl,
  spanNodeId,
}: {
  sessionUrl: string;
  spanNodeId: string;
}) {
  const url = new URL(sessionUrl);
  url.searchParams.set("selectedSpanNodeId", spanNodeId);
  return url.toString();
}

async function installBrowserMeasurementTracker(page: Page) {
  await page.evaluate("globalThis.__name = (target) => target");
  await page.evaluate(() => {
    type MutableMeasurement = BrowserMeasurement & {
      scheduledPaintMetrics: Set<
        "bodyPaintMs" | "routePaintMs" | "selectionPaintMs" | "skeletonPaintMs"
      >;
      startTime: number;
    };

    type BenchmarkController = {
      clear: () => void;
      getCurrentMeasurement: () => MutableMeasurement | null;
      getMeasurements: () => BrowserMeasurement[];
    };

    type BenchmarkWindow = typeof window & {
      __spanDetailsBenchmark?: BenchmarkController;
    };

    const benchmarkWindow = window as BenchmarkWindow;
    if (benchmarkWindow.__spanDetailsBenchmark) return;

    const measurements: BrowserMeasurement[] = [];
    const longTasks: Array<{ duration: number; startTime: number }> = [];
    let currentMeasurement: MutableMeasurement | null = null;
    let longTaskObserver: PerformanceObserver | null = null;

    const getHeapUsage = () => {
      const performanceWithMemory = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      return performanceWithMemory.memory?.usedJSHeapSize ?? null;
    };

    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    }

    const finalizeMeasurement = (measurement: MutableMeasurement) => {
      if (
        currentMeasurement !== measurement ||
        measurement.bodyPaintMs == null ||
        measurement.routePaintMs == null ||
        measurement.selectionPaintMs == null
      ) {
        return;
      }
      for (const entry of longTaskObserver?.takeRecords() ?? []) {
        longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime,
        });
      }
      const endTime =
        measurement.startTime +
        Math.max(measurement.bodyPaintMs, measurement.routePaintMs);
      const relevantLongTasks = longTasks.filter(
        (entry) =>
          entry.startTime + entry.duration >= measurement.startTime &&
          entry.startTime <= endTime
      );
      const graphQlResources = performance
        .getEntriesByType("resource")
        .filter(
          (entry): entry is PerformanceResourceTiming =>
            entry instanceof PerformanceResourceTiming &&
            new URL(entry.name).pathname.endsWith("/graphql") &&
            entry.startTime >= measurement.startTime &&
            entry.startTime <= endTime
        );

      measurement.longTaskCount = relevantLongTasks.length;
      measurement.totalLongTaskMs = relevantLongTasks.reduce(
        (total, entry) => total + entry.duration,
        0
      );
      measurement.longestLongTaskMs = Math.max(
        0,
        ...relevantLongTasks.map((entry) => entry.duration)
      );
      measurement.graphQlRequestCount = graphQlResources.length;
      measurement.graphQlTransferBytes = graphQlResources.reduce(
        (total, entry) => total + entry.transferSize,
        0
      );
      measurement.graphQlEncodedBodyBytes = graphQlResources.reduce(
        (total, entry) => total + entry.encodedBodySize,
        0
      );
      measurement.domNodesAfter = document.getElementsByTagName("*").length;
      measurement.mountedLlmMessagesAfter = document.querySelectorAll(
        `[data-span-details-body-id="${CSS.escape(measurement.targetSpanNodeId)}"] [data-llm-message-state="mounted"]`
      ).length;
      measurement.heapAfterBytes = getHeapUsage();

      const {
        scheduledPaintMetrics: _scheduled,
        startTime: _start,
        ...result
      } = measurement;
      measurements.push(result);
      currentMeasurement = null;
    };

    const schedulePaintMeasurement = ({
      measurement,
      metric,
    }: {
      measurement: MutableMeasurement;
      metric:
        | "bodyPaintMs"
        | "routePaintMs"
        | "selectionPaintMs"
        | "skeletonPaintMs";
    }) => {
      if (measurement.scheduledPaintMetrics.has(metric)) return;
      measurement.scheduledPaintMetrics.add(metric);
      requestAnimationFrame(() => {
        if (currentMeasurement !== measurement) return;
        measurement[metric] = performance.now() - measurement.startTime;
        finalizeMeasurement(measurement);
      });
    };

    const inspectMeasurement = (measurement: MutableMeasurement) => {
      if (currentMeasurement !== measurement) return;
      const escapedTargetId = CSS.escape(measurement.targetSpanNodeId);
      const elapsed = performance.now() - measurement.startTime;
      const selectedTreeNode = document.querySelector(
        `[data-trace-tree-span-node-id="${escapedTargetId}"][data-selected="true"]`
      );
      const dehydratedDetails = document.querySelector(
        `[data-span-details-target-id="${escapedTargetId}"][data-span-details-state="dehydrated"]`
      );
      const detailsBody = document.querySelector(
        `[data-span-details-retained-id="${escapedTargetId}"]:not([hidden]) [data-span-details-body-id="${escapedTargetId}"]:has([data-llm-message-state="mounted"])`
      );
      const routeTargetId = new URL(window.location.href).searchParams.get(
        "selectedSpanNodeId"
      );

      if (selectedTreeNode && measurement.selectionObservedMs == null) {
        measurement.selectionObservedMs = elapsed;
        schedulePaintMeasurement({
          measurement,
          metric: "selectionPaintMs",
        });
      }
      if (dehydratedDetails && measurement.skeletonObservedMs == null) {
        measurement.skeletonObservedMs = elapsed;
        schedulePaintMeasurement({
          measurement,
          metric: "skeletonPaintMs",
        });
      }
      if (detailsBody && measurement.bodyObservedMs == null) {
        measurement.bodyObservedMs = elapsed;
        schedulePaintMeasurement({ measurement, metric: "bodyPaintMs" });
      }
      if (
        routeTargetId === measurement.targetSpanNodeId &&
        measurement.routeObservedMs == null
      ) {
        measurement.routeObservedMs = elapsed;
        schedulePaintMeasurement({ measurement, metric: "routePaintMs" });
      }

      if (
        measurement.bodyPaintMs == null ||
        measurement.routePaintMs == null ||
        measurement.selectionPaintMs == null
      ) {
        requestAnimationFrame(() => inspectMeasurement(measurement));
      }
    };

    const mutationObserver = new MutationObserver(() => {
      if (currentMeasurement) inspectMeasurement(currentMeasurement);
    });
    mutationObserver.observe(document, {
      attributeFilter: [
        "data-selected",
        "data-span-details-body-id",
        "data-span-details-state",
        "data-span-details-target-id",
        "data-trace-tree-span-node-id",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });

    const beginMeasurement = ({
      startTime,
      targetSpanNodeId,
    }: {
      startTime: number;
      targetSpanNodeId: string;
    }) => {
      const measurement: MutableMeasurement = {
        bodyObservedMs: null,
        bodyPaintMs: null,
        domNodesAfter: null,
        domNodesBefore: document.getElementsByTagName("*").length,
        graphQlEncodedBodyBytes: 0,
        graphQlRequestCount: 0,
        graphQlTransferBytes: 0,
        heapAfterBytes: null,
        heapBeforeBytes: getHeapUsage(),
        longestLongTaskMs: 0,
        longTaskCount: 0,
        mountedLlmMessagesAfter: 0,
        routeObservedMs: null,
        routePaintMs: null,
        scheduledPaintMetrics: new Set(),
        selectionObservedMs: null,
        selectionPaintMs: null,
        skeletonObservedMs: null,
        skeletonPaintMs: null,
        startTime,
        targetSpanNodeId,
        totalLongTaskMs: 0,
      };
      currentMeasurement = measurement;
      requestAnimationFrame(() => inspectMeasurement(measurement));
    };

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!(event.target instanceof Element)) return;
        const treeNode = event.target.closest<HTMLElement>(
          "[data-trace-tree-span-node-id]"
        );
        const targetSpanNodeId = treeNode?.dataset.traceTreeSpanNodeId;
        if (!targetSpanNodeId) return;
        beginMeasurement({
          startTime: performance.now(),
          targetSpanNodeId,
        });
      },
      { capture: true }
    );

    benchmarkWindow.__spanDetailsBenchmark = {
      clear: () => {
        currentMeasurement = null;
        measurements.length = 0;
        longTasks.length = 0;
        performance.clearResourceTimings();
      },
      getCurrentMeasurement: () => currentMeasurement,
      getMeasurements: () =>
        measurements.map((measurement) => ({ ...measurement })),
    };
  });
}

async function configurePage({
  cacheDisabled,
  cpuThrottle,
  page,
}: {
  cacheDisabled: boolean;
  cpuThrottle: number;
  page: Page;
}) {
  await page.addInitScript("performance.setResourceTimingBufferSize(10000)");
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("Network.enable");
  await cdpSession.send("Network.setCacheDisabled", {
    cacheDisabled,
  });
  if (cpuThrottle !== 1) {
    await cdpSession.send("Emulation.setCPUThrottlingRate", {
      rate: cpuThrottle,
    });
  }
}

async function waitForMeasurement({
  page,
  previousCount,
  targetSpanNodeId,
}: {
  page: Page;
  previousCount: number;
  targetSpanNodeId: string;
}) {
  try {
    await page.waitForFunction(
      ({ expectedCount, expectedTarget }) => {
        const benchmarkWindow = window as typeof window & {
          __spanDetailsBenchmark?: {
            getMeasurements: () => BrowserMeasurement[];
          };
        };
        const measurements =
          benchmarkWindow.__spanDetailsBenchmark?.getMeasurements() ?? [];
        return (
          measurements.length > expectedCount &&
          measurements.at(-1)?.targetSpanNodeId === expectedTarget
        );
      },
      { expectedCount: previousCount, expectedTarget: targetSpanNodeId }
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const benchmarkWindow = window as typeof window & {
        __spanDetailsBenchmark?: {
          getCurrentMeasurement: () => unknown;
          getMeasurements: () => BrowserMeasurement[];
        };
      };
      return {
        bodyIds: Array.from(
          document.querySelectorAll("[data-span-details-body-id]")
        ).map((element) => element.getAttribute("data-span-details-body-id")),
        current:
          benchmarkWindow.__spanDetailsBenchmark?.getCurrentMeasurement() ??
          null,
        measurements:
          benchmarkWindow.__spanDetailsBenchmark?.getMeasurements() ?? [],
        selectedTreeNodeIds: Array.from(
          document.querySelectorAll(
            '[data-trace-tree-span-node-id][data-selected="true"]'
          )
        ).map((element) =>
          element.getAttribute("data-trace-tree-span-node-id")
        ),
        spanDetailsStates: Array.from(
          document.querySelectorAll("[data-span-details-state]")
        ).map((element) => ({
          state: element.getAttribute("data-span-details-state"),
          target: element.getAttribute("data-span-details-target-id"),
        })),
      };
    });
    throw new Error(
      `Timed out measuring ${targetSpanNodeId}: ${JSON.stringify(diagnostics)}`,
      { cause: error }
    );
  }

  return page.evaluate(() => {
    const benchmarkWindow = window as typeof window & {
      __spanDetailsBenchmark?: {
        getMeasurements: () => BrowserMeasurement[];
      };
    };
    const measurement = benchmarkWindow.__spanDetailsBenchmark
      ?.getMeasurements()
      .at(-1);
    if (!measurement) throw new Error("Browser measurement was not recorded");
    return measurement;
  });
}

async function clickAndMeasure({
  page,
  targetSpanNodeId,
}: {
  page: Page;
  targetSpanNodeId: string;
}) {
  const previousCount = await page.evaluate(() => {
    const benchmarkWindow = window as typeof window & {
      __spanDetailsBenchmark?: {
        getMeasurements: () => BrowserMeasurement[];
      };
    };
    return (
      benchmarkWindow.__spanDetailsBenchmark?.getMeasurements().length ?? 0
    );
  });
  await page
    .locator(`[data-trace-tree-span-node-id="${targetSpanNodeId}"]`)
    .click();
  return waitForMeasurement({ page, previousCount, targetSpanNodeId });
}

async function clearBrowserMeasurements(page: Page) {
  await page.evaluate(() => {
    const benchmarkWindow = window as typeof window & {
      __spanDetailsBenchmark?: { clear: () => void };
    };
    benchmarkWindow.__spanDetailsBenchmark?.clear();
  });
}

async function measureLoadedPage({
  page,
  targetSpanNodeId,
}: {
  page: Page;
  targetSpanNodeId: string;
}): Promise<BrowserMeasurement> {
  await page
    .locator(
      `[data-span-details-retained-id="${targetSpanNodeId}"]:not([hidden]) [data-span-details-body-id="${targetSpanNodeId}"]:has([data-llm-message-state="mounted"])`
    )
    .waitFor();
  return page.evaluate(async (targetSpanNodeId) => {
    const bodyObservedMs = performance.now();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    const bodyPaintMs = performance.now();
    const graphQlResources = performance
      .getEntriesByType("resource")
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming &&
          new URL(entry.name).pathname.endsWith("/graphql")
      );
    const performanceWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number };
    };
    return {
      bodyObservedMs,
      bodyPaintMs,
      domNodesAfter: document.getElementsByTagName("*").length,
      domNodesBefore: 0,
      graphQlEncodedBodyBytes: graphQlResources.reduce(
        (total, entry) => total + entry.encodedBodySize,
        0
      ),
      graphQlRequestCount: graphQlResources.length,
      graphQlTransferBytes: graphQlResources.reduce(
        (total, entry) => total + entry.transferSize,
        0
      ),
      heapAfterBytes: performanceWithMemory.memory?.usedJSHeapSize ?? null,
      heapBeforeBytes: null,
      longestLongTaskMs: 0,
      longTaskCount: 0,
      mountedLlmMessagesAfter: document.querySelectorAll(
        `[data-span-details-body-id="${CSS.escape(targetSpanNodeId)}"] [data-llm-message-state="mounted"]`
      ).length,
      routeObservedMs: null,
      routePaintMs: null,
      selectionObservedMs: null,
      selectionPaintMs: null,
      skeletonObservedMs: null,
      skeletonPaintMs: null,
      targetSpanNodeId,
      totalLongTaskMs: 0,
    };
  }, targetSpanNodeId);
}

async function createBrowser() {
  return chromium.launch({ headless: true });
}

async function runColdSample({
  config,
  run,
  target,
}: {
  config: BenchmarkConfig;
  run: number;
  target: SpanLabel;
}): Promise<BenchmarkSample> {
  const browser = await createBrowser();
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await configurePage({
      cacheDisabled: true,
      cpuThrottle: config.cpuThrottle,
      page,
    });
    const spanNodeId = SPANS[target];
    await page.goto(getSpanUrl({ sessionUrl: config.sessionUrl, spanNodeId }), {
      waitUntil: "domcontentloaded",
    });
    const measurement = await measureLoadedPage({
      page,
      targetSpanNodeId: spanNodeId,
    });
    await context.close();
    return {
      ...measurement,
      direction: `direct-to-${target}`,
      run,
      scenario: "cold",
      target,
    };
  } finally {
    await browser.close();
  }
}

async function runWarmSamples({
  browser,
  config,
}: {
  browser: Browser;
  config: BenchmarkConfig;
}): Promise<BenchmarkSample[]> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await configurePage({
    cacheDisabled: false,
    cpuThrottle: config.cpuThrottle,
    page,
  });
  await page.goto(
    getSpanUrl({
      sessionUrl: config.sessionUrl,
      spanNodeId: SPANS.faster,
    }),
    { waitUntil: "domcontentloaded" }
  );
  await measureLoadedPage({ page, targetSpanNodeId: SPANS.faster });
  await installBrowserMeasurementTracker(page);

  await clickAndMeasure({ page, targetSpanNodeId: SPANS.heavier });
  await clickAndMeasure({ page, targetSpanNodeId: SPANS.faster });
  await clearBrowserMeasurements(page);

  const samples: BenchmarkSample[] = [];
  for (let run = 1; run <= config.warmRuns; run += 1) {
    const heavierMeasurement = await clickAndMeasure({
      page,
      targetSpanNodeId: SPANS.heavier,
    });
    samples.push({
      ...heavierMeasurement,
      direction: "faster-to-heavier",
      run,
      scenario: "warm",
      target: "heavier",
    });

    const fasterMeasurement = await clickAndMeasure({
      page,
      targetSpanNodeId: SPANS.faster,
    });
    samples.push({
      ...fasterMeasurement,
      direction: "heavier-to-faster",
      run,
      scenario: "warm",
      target: "faster",
    });
  }

  await context.close();
  return samples;
}

function calculatePercentile({
  values,
  percentile,
}: {
  values: number[];
  percentile: number;
}) {
  if (values.length === 0) throw new Error("Cannot summarize an empty sample");
  const sortedValues = values.toSorted((left, right) => left - right);
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(percentile * sortedValues.length) - 1
  );
  return sortedValues[index] as number;
}

function summarizeValues(values: number[]): MetricSummary {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    maximum: Math.max(...values),
    mean: total / values.length,
    median: calculatePercentile({ values, percentile: 0.5 }),
    minimum: Math.min(...values),
    p90: calculatePercentile({ values, percentile: 0.9 }),
  };
}

function summarizeSamples(samples: BenchmarkSample[]): GroupSummary[] {
  const groups = new Map<string, BenchmarkSample[]>();
  for (const sample of samples) {
    const key = `${sample.scenario}:${sample.direction}:${sample.target}`;
    const group = groups.get(key) ?? [];
    groups.set(key, [...group, sample]);
  }

  return [...groups.values()].map((group) => {
    const firstSample = group[0];
    if (!firstSample) throw new Error("Benchmark group is unexpectedly empty");
    const metrics: GroupSummary["metrics"] = {};
    for (const metric of NUMERIC_METRICS) {
      const values = group
        .map((sample) => sample[metric])
        .filter((value): value is number => typeof value === "number");
      if (values.length > 0) metrics[metric] = summarizeValues(values);
    }
    return {
      count: group.length,
      direction: firstSample.direction,
      metrics,
      scenario: firstSample.scenario,
      target: firstSample.target,
    };
  });
}

function buildSummaryTsv(summaries: GroupSummary[]) {
  const rows = [
    [
      "scenario",
      "direction",
      "target",
      "count",
      "metric",
      "minimum",
      "median",
      "p90",
      "maximum",
      "mean",
    ].join("\t"),
  ];
  for (const summary of summaries) {
    for (const metric of NUMERIC_METRICS) {
      const values = summary.metrics[metric];
      if (!values) continue;
      rows.push(
        [
          summary.scenario,
          summary.direction,
          summary.target,
          summary.count,
          metric,
          values.minimum,
          values.median,
          values.p90,
          values.maximum,
          values.mean,
        ].join("\t")
      );
    }
  }
  return `${rows.join("\n")}\n`;
}

async function writeResults({
  browserVersion,
  config,
  samples,
}: {
  browserVersion: string;
  config: BenchmarkConfig;
  samples: BenchmarkSample[];
}) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const summaries = summarizeSamples(samples);
  const metadata = {
    browserVersion,
    config,
    recordedAt: new Date().toISOString(),
    revision,
    spans: SPANS,
    viewport: VIEWPORT,
  };
  await mkdir(config.outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(config.outputDirectory, "raw.jsonl"),
      `${samples.map((sample) => JSON.stringify(sample)).join("\n")}\n`
    ),
    writeFile(
      resolve(config.outputDirectory, "summary.json"),
      `${JSON.stringify({ metadata, summaries }, null, 2)}\n`
    ),
    writeFile(
      resolve(config.outputDirectory, "summary.tsv"),
      buildSummaryTsv(summaries)
    ),
  ]);
}

async function main() {
  const config = parseArguments(process.argv.slice(2));
  const samples: BenchmarkSample[] = [];

  for (let run = 1; run <= config.coldRuns; run += 1) {
    const order: SpanLabel[] =
      run % 2 === 0 ? ["heavier", "faster"] : ["faster", "heavier"];
    for (const target of order) {
      const sample = await runColdSample({ config, run, target });
      samples.push(sample);
      process.stdout.write(
        `cold ${target} ${run}/${config.coldRuns}: body ${sample.bodyPaintMs?.toFixed(1)}ms\n`
      );
    }
  }

  const warmBrowser = await createBrowser();
  const browserVersion = warmBrowser.version();
  try {
    const warmSamples = await runWarmSamples({
      browser: warmBrowser,
      config,
    });
    samples.push(...warmSamples);
    for (const sample of warmSamples) {
      process.stdout.write(
        `warm ${sample.direction} ${sample.run}/${config.warmRuns}: selection ${sample.selectionPaintMs?.toFixed(1)}ms, skeleton ${sample.skeletonPaintMs?.toFixed(1)}ms, body ${sample.bodyPaintMs?.toFixed(1)}ms\n`
      );
    }
  } finally {
    await warmBrowser.close();
  }

  await writeResults({ browserVersion, config, samples });
  process.stdout.write(`results: ${config.outputDirectory}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
