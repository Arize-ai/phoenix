/**
 * @generated SignedSource<<1cb50d8be15bdb8023a4e44c6703d532>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareMatrix_comparison$data = {
  readonly a: {
    readonly annotationName: string;
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
  };
  readonly b: {
    readonly annotationName: string;
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
  };
  readonly confusionMatrix: ReadonlyArray<ReadonlyArray<number>>;
  readonly evaluationTarget: EvaluationTarget;
  readonly populationSize: number;
  readonly " $fragmentType": "ProjectEvaluatorCompareMatrix_comparison";
};
export type ProjectEvaluatorCompareMatrix_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareMatrix_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareMatrix_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "annotationName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labels",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "threshold",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareMatrix_comparison",
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
      "kind": "ScalarField",
      "name": "populationSize",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "confusionMatrix",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluatorComparison",
  "abstractKey": null
};
})();

(node as any).hash = "0cd08d8b766764428e00656f4d613abf";

export default node;
