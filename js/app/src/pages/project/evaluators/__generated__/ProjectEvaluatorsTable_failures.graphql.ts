/**
 * @generated SignedSource<<eca592c411f9748329f206d0abadc25e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_failures$data = {
  readonly failureSummary: {
    readonly droppedCount: number;
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

(node as any).hash = "6b3253d4dfc3cc92279871bc01d815f5";

export default node;
