/**
 * @generated SignedSource<<6c9868611fcb12bf891bf0451a3c371c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareDistributions_comparison$data = {
  readonly coverage: {
    readonly evaluatedByBoth: number;
    readonly onlyA: number;
    readonly onlyB: number;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly sideA: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
  };
  readonly sideB: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
  };
  readonly " $fragmentType": "ProjectEvaluatorCompareDistributions_comparison";
};
export type ProjectEvaluatorCompareDistributions_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareDistributions_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v2 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "ProjectEvaluatorCompareDistributions_side",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "threshold",
        "storageKey": null
      },
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
          (v0/*:: as any*/),
          (v1/*:: as any*/)
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
          (v0/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isOther",
            "storageKey": null
          },
          (v1/*:: as any*/)
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
  "name": "ProjectEvaluatorCompareDistributions_comparison",
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
      "concreteType": "EvaluatorComparisonCoverage",
      "kind": "LinkedField",
      "name": "coverage",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "evaluatedByBoth",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "onlyA",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "onlyB",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideA",
      "plural": false,
      "selections": (v2/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideB",
      "plural": false,
      "selections": (v2/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluatorComparison",
  "abstractKey": null
};
})();

(node as any).hash = "53a9ef66146c6e1da7982d58137afaaf";

export default node;
