/**
 * @generated SignedSource<<c0fa411b12104fb75fe7d12d8731e159>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareTargets_comparison$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly sideA: {
    readonly annotationName: string;
    readonly flaggedLabels: ReadonlyArray<string> | null;
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
  };
  readonly sideB: {
    readonly annotationName: string;
    readonly flaggedLabels: ReadonlyArray<string> | null;
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
  };
  readonly " $fragmentType": "ProjectEvaluatorCompareTargets_comparison";
};
export type ProjectEvaluatorCompareTargets_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareTargets_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTargets_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v3 = [
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
  (v0/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "flaggedLabels",
    "storageKey": null
  },
  {
    "kind": "InlineDataFragmentSpread",
    "name": "ProjectEvaluatorCompareDistributions_side",
    "selections": [
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "allEvaluatedMeanScore",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "scoreBinEdges",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "scoreBinCounts",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluatorScoreValueCount",
        "kind": "LinkedField",
        "name": "scoreValueCounts",
        "plural": true,
        "selections": [
          (v1/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluatorLabelCount",
        "kind": "LinkedField",
        "name": "labelCounts",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "label",
            "storageKey": null
          },
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isOther",
            "storageKey": null
          },
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "args": null,
    "argumentDefinitions": ([]/*:: as any*/)
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareTargets_comparison",
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
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideA",
      "plural": false,
      "selections": (v3/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideB",
      "plural": false,
      "selections": (v3/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluatorComparison",
  "abstractKey": null
};
})();

(node as any).hash = "713c59cf0889415942518e200f3a6c27";

export default node;
