/**
 * @generated SignedSource<<bf2fa571afe0df8680642a2d0501e3a9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_lag$data = {
  readonly lag: {
    readonly p50Seconds: number;
    readonly p95Seconds: number;
    readonly p99Seconds: number;
  } | null;
  readonly " $fragmentType": "ProjectEvaluatorsTable_lag";
};
export type ProjectEvaluatorsTable_lag$key = {
  readonly " $data"?: ProjectEvaluatorsTable_lag$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_lag">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_lag"
};

(node as any).hash = "c5de5858d50dbc993621c22ec840db45";

export default node;
