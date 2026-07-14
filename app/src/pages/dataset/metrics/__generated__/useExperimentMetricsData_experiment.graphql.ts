/**
 * @generated SignedSource<<29606fb8df445d913b609885ed4000fd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentMetricsData_experiment$data = {
  readonly annotationSummaries: ReadonlyArray<{
    readonly annotationName: string;
    readonly meanScore: number | null;
  }>;
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

(node as any).hash = "142fd431e6dc33362e831daef378b6a5";

export default node;
