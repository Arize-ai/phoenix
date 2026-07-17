/**
 * @generated SignedSource<<090c5835de7bb5953357c4346cd25773>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentMetricsData_experiment$data = {
  readonly averageRunLatencyMs: number | null;
  readonly costSummary: {
    readonly completion: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
    readonly prompt: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
    readonly total: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
  };
  readonly errorRate: number | null;
  readonly id: string;
  readonly name: string;
  readonly runCount: number;
  readonly sequenceNumber: number;
  readonly " $fragmentType": "useExperimentMetricsData_experiment";
};
export type useExperimentMetricsData_experiment$key = {
  readonly " $data"?: useExperimentMetricsData_experiment$data;
  readonly " $fragmentSpreads": FragmentRefs<"useExperimentMetricsData_experiment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "useExperimentMetricsData_experiment"
};

(node as any).hash = "5281297372d432a038ec6604a1fa5c94";

export default node;
