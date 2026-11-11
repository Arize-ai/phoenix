/**
 * @generated SignedSource<<6774e7b994a041fba67418ac80edfc8c>>
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
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
    } | null;
    readonly series: ReadonlyArray<{
      readonly count: number;
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

(node as any).hash = "5434537456bc109c9851c86426ecbd14";

export default node;
