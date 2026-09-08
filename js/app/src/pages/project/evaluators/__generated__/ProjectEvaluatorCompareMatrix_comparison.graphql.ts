/**
 * @generated SignedSource<<595d49bd7c08272596b52961d232bebd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareMatrix_comparison$data = {
  readonly confusionMatrix: ReadonlyArray<ReadonlyArray<number>>;
  readonly coverage: {
    readonly evaluatedByBoth: number;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly sideA: {
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
  };
  readonly sideB: {
    readonly labels: ReadonlyArray<string>;
    readonly threshold: number | null;
  };
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
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideA",
      "plural": false,
      "selections": (v0/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorComparisonSide",
      "kind": "LinkedField",
      "name": "sideB",
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

(node as any).hash = "23960b87aa16da866690771747c192ee";

export default node;
