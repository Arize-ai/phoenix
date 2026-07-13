/**
 * @generated SignedSource<<c335bd52848c480f03fff1c3be8b1b94>>
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
    readonly count: number;
    readonly labelCount: number;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
    readonly scoreCount: number;
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

(node as any).hash = "78e6955359e1a547578aaee93154e633";

export default node;
