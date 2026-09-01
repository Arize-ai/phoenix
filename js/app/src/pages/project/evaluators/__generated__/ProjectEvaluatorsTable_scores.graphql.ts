/**
 * @generated SignedSource<<e026efb010b7b6cbc44b436b142ace4a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_scores$data = {
  readonly annotationScoreMetrics?: ReadonlyArray<{
    readonly annotationName: string;
    readonly previousSummary: {
      readonly meanScore: number | null;
    } | null;
    readonly series: ReadonlyArray<{
      readonly meanScore: number | null;
      readonly timestamp: string;
    }>;
    readonly summary: {
      readonly count: number;
      readonly labelCount: number;
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
      readonly scoreCount: number;
    } | null;
  }>;
  readonly " $fragmentType": "ProjectEvaluatorsTable_scores";
};
export type ProjectEvaluatorsTable_scores$key = {
  readonly " $data"?: ProjectEvaluatorsTable_scores$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_scores">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_scores"
};

(node as any).hash = "0890ed3279cd4da7ddf7ce617cd9fe57";

export default node;
