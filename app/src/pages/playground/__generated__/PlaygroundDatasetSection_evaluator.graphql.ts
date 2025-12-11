/**
 * @generated SignedSource<<0c149da528c99bc88cdbf0a097c11c17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetSection_evaluator$data = {
  readonly displayName: string;
  readonly evaluator: {
    readonly isBuiltin: boolean;
    readonly kind: EvaluatorKind;
    readonly outputConfig?: {
      readonly name: string;
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

(node as any).hash = "40f931609ec707bd39fc85ae364234e2";

export default node;
