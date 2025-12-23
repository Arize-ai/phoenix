/**
 * @generated SignedSource<<3ee007d98043494eb04a2b3b8bcf323b>>
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
    readonly id: string;
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

(node as any).hash = "20d347227a2ade40a8ab522b23b1c591";

export default node;
