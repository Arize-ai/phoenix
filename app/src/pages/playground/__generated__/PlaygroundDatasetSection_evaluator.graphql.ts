/**
 * @generated SignedSource<<9b349ea5a95bac301c89a1e52d8b4a46>>
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
  readonly displayName: string;
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
  readonly outputConfig: {
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly values: ReadonlyArray<{
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

(node as any).hash = "4316c505357d726cdb9643d5b6a75de8";

export default node;
