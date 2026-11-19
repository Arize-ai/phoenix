/**
 * @generated SignedSource<<096d99ea9c7598bdaeb33630e6c80f44>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorMeanScoreCell_previousSummary$data = {
  readonly previousSummary: {
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
  } | null;
  readonly " $fragmentType": "ProjectEvaluatorMeanScoreCell_previousSummary";
};
export type ProjectEvaluatorMeanScoreCell_previousSummary$key = {
  readonly " $data"?: ProjectEvaluatorMeanScoreCell_previousSummary$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorMeanScoreCell_previousSummary">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorMeanScoreCell_previousSummary"
};

(node as any).hash = "fee55a1cf0db7fb6aa17d7949bfcbe0f";

export default node;
