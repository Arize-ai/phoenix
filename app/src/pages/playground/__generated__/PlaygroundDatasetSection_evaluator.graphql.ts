/**
 * @generated SignedSource<<b119c5cd6a78da96464bdb8df72e9b76>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetSection_evaluator$data = {
  readonly evaluator: {
    readonly id: string;
    readonly isBuiltin: boolean;
    readonly kind: EvaluatorKind;
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly name: string;
  readonly outputConfig: {
    readonly lowerBound?: number | null;
    readonly name?: string;
    readonly optimizationDirection?: OptimizationDirection;
    readonly upperBound?: number | null;
    readonly values?: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  } | null;
  readonly " $fragmentType": "PlaygroundDatasetSection_evaluator";
};
export type PlaygroundDatasetSection_evaluator$key = {
  readonly " $data"?: PlaygroundDatasetSection_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetSection_evaluator">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "PlaygroundDatasetSection_evaluator"
};

(node as any).hash = "7b1b29c602cc724819f57302e62ac962";

export default node;
