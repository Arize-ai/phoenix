/**
 * @generated SignedSource<<9804385ca724d74e040e2feba5a49807>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
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
      readonly annotationType?: AnnotationType;
      readonly lowerBound?: number | null;
      readonly optimizationDirection?: OptimizationDirection;
      readonly threshold?: number | null;
      readonly upperBound?: number | null;
      readonly values?: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
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
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
};
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
              "selections": [
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
                (v0/*:: as any*/),
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
                (v0/*:: as any*/),
                (v1/*:: as any*/),
                (v2/*:: as any*/)
              ],
              "type": "ContinuousAnnotationConfig",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v0/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "threshold",
                  "storageKey": null
                },
                (v1/*:: as any*/),
                (v2/*:: as any*/)
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

(node as any).hash = "f92189554f23d596ad377cb7a9811f78";

export default node;
