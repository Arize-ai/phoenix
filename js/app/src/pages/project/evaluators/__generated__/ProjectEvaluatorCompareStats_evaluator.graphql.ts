/**
 * @generated SignedSource<<1e7b9c3dd841a679f3d489dff7b2d549>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareStats_evaluator$data = {
  readonly evaluator: {
    readonly outputConfigs: ReadonlyArray<{
      readonly annotationType?: AnnotationType;
      readonly lowerBound?: number | null;
      readonly name?: string;
      readonly optimizationDirection?: OptimizationDirection;
      readonly threshold?: number | null;
      readonly upperBound?: number | null;
      readonly values?: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
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
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareStats_evaluator",
  "selections": [
    (v0/*:: as any*/),
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
              "selections": [
                (v0/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "annotationType",
                  "storageKey": null
                }
              ],
              "type": "AnnotationConfigBase",
              "abstractKey": "__isAnnotationConfigBase"
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "CategoricalAnnotationValue",
                  "kind": "LinkedField",
                  "name": "values",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "score",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "CategoricalAnnotationConfig",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                (v2/*:: as any*/),
                (v3/*:: as any*/)
              ],
              "type": "ContinuousAnnotationConfig",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "threshold",
                  "storageKey": null
                },
                (v2/*:: as any*/),
                (v3/*:: as any*/)
              ],
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

(node as any).hash = "866186ac7040e9e1c158a1fd89130026";

export default node;
