/**
 * @generated SignedSource<<8e881bea1e659a05d5de67bcaa5be6a4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_failures$data = {
  readonly failureSummary: {
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly failureRate: number | null;
    readonly lastError: string | null;
    readonly lastFailedAt: string | null;
  };
  readonly " $fragmentType": "ProjectEvaluatorsTable_failures";
};
export type ProjectEvaluatorsTable_failures$key = {
  readonly " $data"?: ProjectEvaluatorsTable_failures$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_failures">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_failures"
};

(node as any).hash = "cd83f2ba29c3f4cdbd5290fb82ca05e9";

export default node;
