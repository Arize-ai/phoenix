/**
 * @generated SignedSource<<757d9f5f7d0c4778286cf572fdce39da>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareStats_comparison$data = {
  readonly a: {
    readonly threshold: number | null;
  };
  readonly b: {
    readonly threshold: number | null;
  };
  readonly coverage: {
    readonly evaluatedByBoth: number;
    readonly onlyA: number;
    readonly onlyB: number;
    readonly totalInRange: number;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly populationSize: number;
  readonly statistics: {
    readonly agreement: number | null;
    readonly cohensKappa: number | null;
    readonly disagreementCount: number | null;
    readonly spearmanRho: number | null;
  };
  readonly " $fragmentType": "ProjectEvaluatorCompareStats_comparison";
};
export type ProjectEvaluatorCompareStats_comparison$key = {
  readonly " $data"?: ProjectEvaluatorCompareStats_comparison$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareStats_comparison">;
};

const node: ReaderFragment = (function(){
var v0 = [
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
  "name": "ProjectEvaluatorCompareStats_comparison",
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalInRange",
          "storageKey": null
        }
      ],
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
      "concreteType": "EvaluatorComparisonStatistics",
      "kind": "LinkedField",
      "name": "statistics",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "agreement",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cohensKappa",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "spearmanRho",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "disagreementCount",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluatorComparison",
  "abstractKey": null
};
})();

(node as any).hash = "e3906cea3f77e906602a4ba101bf683f";

export default node;
