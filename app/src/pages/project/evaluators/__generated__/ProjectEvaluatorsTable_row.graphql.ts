/**
 * @generated SignedSource<<1f48ec96f80306ecaed61b3885b151c4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_row$data = {
  readonly enabled: boolean;
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly description: string | null;
    readonly inputMapping?: {
      readonly literalMapping: any;
      readonly pathMapping: any;
    };
    readonly kind: EvaluatorKind;
  };
  readonly filterCondition: string;
  readonly id: string;
  readonly name: string;
  readonly samplingRate: number;
  readonly " $fragmentType": "ProjectEvaluatorsTable_row";
};
export type ProjectEvaluatorsTable_row$key = {
  readonly " $data"?: ProjectEvaluatorsTable_row$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_row">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_row"
};

(node as any).hash = "662183626570c055c42f57b76c1c5cb3";

export default node;
