/**
 * @generated SignedSource<<5638a3a58278b60adaf4e363311cd1a1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareDistributions_comparison$data = {
  readonly a: {
    readonly sharedDistribution: {
      readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
    };
  };
  readonly b: {
    readonly sharedDistribution: {
      readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
    };
  };
  readonly coverage: {
    readonly evaluatedByBoth: number;
  };
  readonly " $fragmentType": "ProjectEvaluatorCompareDistributions_comparison";
};
export type ProjectEvaluatorCompareDistributions_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareDistributions_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluatorDistribution",
    "kind": "LinkedField",
    "name": "sharedDistribution",
    "plural": false,
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectEvaluatorCompareDistributions_side"
      }
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
        }
      ],
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

(node as any).hash = "cabead6ac6acd7cd5ec93188eeccefa5";

export default node;
