/**
 * @generated SignedSource<<1e848bf386591e10aaad8be8f699446f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareDistributions_evaluator$data = {
  readonly distribution: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly outputConfigs: ReadonlyArray<{
      readonly optimizationDirection?: OptimizationDirection;
    }>;
  };
  readonly id: string;
  readonly name: string;
  readonly " $fragmentType": "ProjectEvaluatorCompareDistributions_evaluator";
};
export type ProjectEvaluatorCompareDistributions_evaluator$key = {
  readonly " $data"?: ProjectEvaluatorCompareDistributions_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_evaluator">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "optimizationDirection",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareDistributions_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationTarget",
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "EvaluatorDistribution",
      "kind": "LinkedField",
      "name": "distribution",
      "plural": false,
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "ProjectEvaluatorCompareDistributions_side"
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "outputConfigs",
          "plural": true,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": (v0/*:: as any*/),
              "type": "CategoricalAnnotationConfig",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": (v0/*:: as any*/),
              "type": "ContinuousAnnotationConfig",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": (v0/*:: as any*/),
              "type": "FreeformAnnotationConfig",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "4cf2359bd4311f6978fe1369497b8350";

export default node;
