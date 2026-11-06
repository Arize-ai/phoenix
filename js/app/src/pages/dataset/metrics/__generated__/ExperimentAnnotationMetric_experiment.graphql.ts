/**
 * @generated SignedSource<<3c27875a3b02007b5d97c487c8477116>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentAnnotationMetric_experiment$data = {
  readonly annotationSummaries: ReadonlyArray<{
    readonly annotationName: string;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
  }>;
  readonly id: string;
  readonly isBaseline: boolean;
  readonly name: string;
  readonly sequenceNumber: number;
  readonly " $fragmentType": "ExperimentAnnotationMetric_experiment";
};
export type ExperimentAnnotationMetric_experiment$key = {
  readonly " $data"?: ExperimentAnnotationMetric_experiment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentAnnotationMetric_experiment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ExperimentAnnotationMetric_experiment"
};

(node as any).hash = "4dd9463277a80e9f021d4c91b0125e34";

export default node;
