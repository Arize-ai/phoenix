/**
 * @generated SignedSource<<bac267ea79c125adaf6e717a80400b3f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareDistributions_side$data = {
  readonly allEvaluatedMeanScore: number | null;
  readonly labelCounts: ReadonlyArray<{
    readonly count: number;
    readonly isOther: boolean;
    readonly label: string;
    readonly score: number | null;
  }> | null;
  readonly scoreBinCounts: ReadonlyArray<number> | null;
  readonly scoreBinEdges: ReadonlyArray<number> | null;
  readonly scoreValueCounts: ReadonlyArray<{
    readonly count: number;
    readonly score: number;
  }> | null;
  readonly threshold: number | null;
  readonly " $fragmentType": "ProjectEvaluatorCompareDistributions_side";
};
export type ProjectEvaluatorCompareDistributions_side$key = {
  readonly " $data"?: ProjectEvaluatorCompareDistributions_side$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorCompareDistributions_side"
};

(node as any).hash = "de977866640dfc15ab62b35d91340708";

export default node;
