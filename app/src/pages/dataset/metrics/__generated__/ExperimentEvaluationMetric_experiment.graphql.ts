/**
 * @generated SignedSource<<49d489eb21a2e9ab0bc1d74d1374f553>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentEvaluationMetric_experiment$data = {
  readonly annotationSummaries: ReadonlyArray<{
    readonly annotationName: string;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
  }>;
  readonly id: string;
  readonly name: string;
  readonly sequenceNumber: number;
  readonly " $fragmentType": "ExperimentEvaluationMetric_experiment";
};
export type ExperimentEvaluationMetric_experiment$key = {
  readonly " $data"?: ExperimentEvaluationMetric_experiment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentEvaluationMetric_experiment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ExperimentEvaluationMetric_experiment"
};

(node as any).hash = "40b71b5340c85eb462420af178f81653";

export default node;
