/**
 * @generated SignedSource<<8cc9378fc61c58b6c4c5c82ee215b40a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareTimeSeries_comparison$data = {
  readonly a: {
    readonly annotationName: string;
  };
  readonly b: {
    readonly annotationName: string;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly " $fragmentType": "ProjectEvaluatorCompareTimeSeries_comparison";
};
export type ProjectEvaluatorCompareTimeSeries_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareTimeSeries_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTimeSeries_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "annotationName",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareTimeSeries_comparison",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationTarget",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSummary",
      "kind": "LinkedField",
      "name": "a",
      "plural": false,
      "selections": (v0/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSummary",
      "kind": "LinkedField",
      "name": "b",
      "plural": false,
      "selections": (v0/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluatorComparison",
  "abstractKey": null
};
})();

(node as any).hash = "4394018c75559abf592207e0955611d2";

export default node;
