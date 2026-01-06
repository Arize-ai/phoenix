/**
 * @generated SignedSource<<681e9837878760490dfc5d9c3e99614c>>
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
    readonly outputConfig?: {
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    };
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
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

(node as any).hash = "e69f7ef98d52e4dec350d215c3b84521";

export default node;
