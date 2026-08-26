/**
 * PII-detection evaluator benchmark
 *
 * The dataset is a 150-record sample of the public
 * nvidia/Nemotron-PII dataset (see scripts/benchmarks/pii_detection/
 * sample_nemotron.py), committed as a fixture for deterministic, offline runs.
 * Nemotron-PII is a span-annotated NER corpus that is ~99% positive, so this
 * iteration measures only the binary DETECTION RATE: given realistic
 * PII-bearing text, does the evaluator score `pii_detected`? Because there are
 * effectively no negatives, precision / false-positive rate cannot be measured
 * here. For a balanced precision/recall suite, see
 * `pii_detection.synthetic.eval.ts`.
 * 
  * Before running this benchmark, generate the fixture:
 *   python scripts/benchmarks/pii_detection/sample_nemotron.py \
 *     --n 150 --seed 20250824 \
 *     --out js/benchmarks/evals-benchmarks/src/fixtures/pii_detection.nemotron.jsonl
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as px from "@arizeai/phoenix-client/vitest";
import { createPiiDetectionEvaluator } from "@arizeai/phoenix-evals";

import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

type PiiLabel = "pii_detected" | "no_pii_detected";

type NemotronRecord = {
  uid: string;
  domain: string;
  document_type: string;
  document_format: string;
  locale: string;
  text: string;
  pii_categories: string[];
  expected_label: PiiLabel;
};

const fixturePath = fileURLToPath(
  new URL("./fixtures/pii_detection.nemotron.jsonl", import.meta.url)
);
const records = readFileSync(fixturePath, "utf-8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as NemotronRecord);

const evaluator = createPiiDetectionEvaluator({
  model: evalModel,
});

const cases = records.map((record) => ({
  input: { conversation: record.text },
  expected: { label: record.expected_label },
  metadata: {
    uid: record.uid,
    domain: record.domain,
    document_type: record.document_type,
    document_format: record.document_format,
    locale: record.locale,
    pii_categories: record.pii_categories,
  },
  splits: [record.document_format, record.locale],
}));

// Detection-rate accumulator: on an all-positive dataset, accuracy equals the
// fraction of PII-bearing documents the evaluator correctly flags.
let detected = 0;
let scored = 0;

px.describe(
  "pii-detection-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.document_format)}/${String(
          row.metadata?.locale
        )}] ${String(row.metadata?.domain)} (${String(row.metadata?.uid)})`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "pii_detection",
          label: result.label,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        scored += 1;
        if (result.label === expected?.label) {
          detected += 1;
        }
        await px.evaluate(accuracy);
      }
    );

    px.test(
      "detection rate: fraction of PII-bearing documents flagged pii_detected",
      {
        input: {
          description: "Detection rate across every case in this suite",
        },
      },
      async () => {
        const detectionRate = scored === 0 ? 0 : detected / scored;
        px.logOutput({ detected, scored, detectionRate });
      }
    );
  },
  {
    description:
      "PII detection rate on a stratified 150-record sample of nvidia/Nemotron-PII (structured/unstructured x US/intl). All cases contain PII, so accuracy measures recall (detection rate).",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.9 },
    ],
  }
);
