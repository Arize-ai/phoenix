/**
 * @generated SignedSource<<b42da59fbebae9bca4948f4f66102096>>
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
    readonly eligible: number | null;
    readonly evaluatedByBoth: number;
    readonly onlyA: number;
    readonly onlyB: number;
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
          "name": "eligible",
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

(node as any).hash = "caad1390b06ece9d1aa303c42271b9c4";

export default node;
