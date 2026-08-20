/**
 * @generated SignedSource<<c9af3e74827cf98985cfc37ca4ab8573>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type LLMProjectEvaluatorAnnotation_projectEvaluator$data = {
  readonly evaluator: {
    readonly outputConfigs?: ReadonlyArray<{
      readonly __typename: "CategoricalAnnotationConfig";
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    } | {
      readonly __typename: "ContinuousAnnotationConfig";
      readonly lowerBound: number | null;
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly upperBound: number | null;
    } | {
      readonly __typename: "FreeformAnnotationConfig";
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
    readonly promptVersion?: {
      readonly tools: {
        readonly tools: ReadonlyArray<{
          readonly __typename: "PromptToolFunction";
          readonly function: {
            readonly parameters: any;
          };
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        }>;
      } | null;
    };
  };
  readonly " $fragmentType": "LLMProjectEvaluatorAnnotation_projectEvaluator";
};
export type LLMProjectEvaluatorAnnotation_projectEvaluator$key = {
  readonly " $data"?: LLMProjectEvaluatorAnnotation_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"LLMProjectEvaluatorAnnotation_projectEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LLMProjectEvaluatorAnnotation_projectEvaluator",
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
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptVersion",
              "kind": "LinkedField",
              "name": "promptVersion",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "PromptTools",
                  "kind": "LinkedField",
                  "name": "tools",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "tools",
                      "plural": true,
                      "selections": [
                        (v0/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptToolFunctionDefinition",
                              "kind": "LinkedField",
                              "name": "function",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "parameters",
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "PromptToolFunction",
                          "abstractKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "outputConfigs",
              "plural": true,
              "selections": [
                (v0/*:: as any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
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
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lowerBound",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "upperBound",
                      "storageKey": null
                    }
                  ],
                  "type": "ContinuousAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
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
          "type": "LLMEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "f22e43e1a6513209bcbebf9c044ada4e";

export default node;
