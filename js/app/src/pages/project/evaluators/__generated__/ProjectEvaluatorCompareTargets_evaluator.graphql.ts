/**
 * @generated SignedSource<<ba7eff19254cf4e895ea12af95d4b30b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareTargets_evaluator$data = {
  readonly evaluator: {
    readonly outputConfigs: ReadonlyArray<{
      readonly optimizationDirection?: OptimizationDirection;
    }>;
  };
  readonly " $fragmentType": "ProjectEvaluatorCompareTargets_evaluator";
};
export type ProjectEvaluatorCompareTargets_evaluator$key = {
  readonly " $data"?: ProjectEvaluatorCompareTargets_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTargets_evaluator">;
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
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareTargets_evaluator",
  "selections": [
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

(node as any).hash = "f09c5c7190733cbe2e8d5671ff46897e";

export default node;
