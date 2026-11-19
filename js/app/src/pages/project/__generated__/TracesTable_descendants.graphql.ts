/**
 * @generated SignedSource<<22aac0630ce29a28d2857a82230854f1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotatorKind = "AGENT" | "CODE" | "DECISION" | "HUMAN" | "LLM";
export type SpanKind = "agent" | "chain" | "decision" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type TracesTable_descendants$data = {
  readonly descendants: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly cumulativeTokenCountTotal: number | null;
        readonly documentRetrievalMetrics: ReadonlyArray<{
          readonly evaluationName: string;
          readonly hit: number | null;
          readonly ndcg: number | null;
          readonly precision: number | null;
        }>;
        readonly endTime: string | null;
        readonly id: string;
        readonly input: {
          readonly value: string;
        } | null;
        readonly latencyMs: number | null;
        readonly name: string;
        readonly output: {
          readonly value: string;
        } | null;
        readonly parentId: string | null;
        readonly spanAnnotations: ReadonlyArray<{
          readonly annotatorKind: AnnotatorKind;
          readonly createdAt: string;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        }>;
        readonly spanId: string;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
        readonly statusMessage: string;
        readonly trace: {
          readonly id: string;
          readonly traceId: string;
        };
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
      };
    }>;
  };
  readonly " $fragmentType": "TracesTable_descendants";
};
export type TracesTable_descendants$key = {
  readonly " $data"?: TracesTable_descendants$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_descendants">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "TracesTable_descendants"
};

(node as any).hash = "816f9a3a44676951ca5802c1f22f4523";

export default node;
