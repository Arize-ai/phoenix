/**
 * @generated SignedSource<<7547b9f091e255f7669e2cda791c7720>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpansTableAside_stats$data = {
  readonly costSummary: {
    readonly completion: {
      readonly cost: number | null;
    };
    readonly prompt: {
      readonly cost: number | null;
    };
    readonly total: {
      readonly cost: number | null;
    };
  };
  readonly latencyMsP50: number | null;
  readonly latencyMsP99: number | null;
  readonly timeRangeTraceCount: number;
  readonly " $fragmentType": "SpansTableAside_stats";
};
export type SpansTableAside_stats$key = {
  readonly " $data"?: SpansTableAside_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpansTableAside_stats">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "SpansTableAside_stats"
};

(node as any).hash = "4663f55d07fdf036d044a926fd0080a0";

export default node;
