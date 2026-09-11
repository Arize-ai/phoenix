/**
 * @generated SignedSource<<9943e2158f658f5781a6ac8d20deade2>>
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
    readonly allEvaluatedMeanScore: number | null;
    readonly labelCounts: ReadonlyArray<{
      readonly count: number;
      readonly isOther: boolean;
      readonly label: string;
      readonly score: number | null;
    }> | null;
    readonly scoreBinCounts: ReadonlyArray<number> | null;
    readonly scoreBinEdges: ReadonlyArray<number> | null;
    readonly scoreValueCounts: ReadonlyArray<{
      readonly count: number;
      readonly score: number;
    }> | null;
    readonly threshold: number | null;
  };
  readonly sideB: {
    readonly allEvaluatedMeanScore: number | null;
    readonly labelCounts: ReadonlyArray<{
      readonly count: number;
      readonly isOther: boolean;
      readonly label: string;
      readonly score: number | null;
    }> | null;
    readonly scoreBinCounts: ReadonlyArray<number> | null;
    readonly scoreBinEdges: ReadonlyArray<number> | null;
    readonly scoreValueCounts: ReadonlyArray<{
      readonly count: number;
      readonly score: number;
    }> | null;
    readonly threshold: number | null;
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

(node as any).hash = "70401789cf201c7530e66dbed475dd4a";

export default node;
