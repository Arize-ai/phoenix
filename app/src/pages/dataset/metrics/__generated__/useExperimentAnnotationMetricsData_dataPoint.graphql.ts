/**
 * @generated SignedSource<<e0b3c0ad6cfd997930c278664ebf322f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentAnnotationMetricsData_dataPoint$data = {
  readonly annotationSummaries: ReadonlyArray<{
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
    readonly name: string;
  }>;
  readonly experiment: {
    readonly id: string;
    readonly name: string;
    readonly sequenceNumber: number;
  };
  readonly " $fragmentType": "useExperimentAnnotationMetricsData_dataPoint";
};
export type useExperimentAnnotationMetricsData_dataPoint$key = {
  readonly " $data"?: useExperimentAnnotationMetricsData_dataPoint$data;
  readonly " $fragmentSpreads": FragmentRefs<"useExperimentAnnotationMetricsData_dataPoint">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "useExperimentAnnotationMetricsData_dataPoint"
};

(node as any).hash = "b8891080d4d2a06436979dec0f2afc30";

export default node;
