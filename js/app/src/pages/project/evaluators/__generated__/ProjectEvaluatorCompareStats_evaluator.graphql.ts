/**
 * @generated SignedSource<<229e4af4ee2fcb5cf61689572136ddc0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareStats_evaluator$data = {
  readonly evaluator: {
    readonly outputConfigs: ReadonlyArray<{
      readonly optimizationDirection?: OptimizationDirection;
    }>;
  };
  readonly name: string;
  readonly " $fragmentType": "ProjectEvaluatorCompareStats_evaluator";
};
export type ProjectEvaluatorCompareStats_evaluator$key = {
  readonly " $data"?: ProjectEvaluatorCompareStats_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareStats_evaluator">;
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
  "name": "ProjectEvaluatorCompareStats_evaluator",
  "selections": [
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

(node as any).hash = "414476fff4aa60605fd850b984319d8c";

export default node;
