/**
 * @generated SignedSource<<2d83c47ab466ddaa14ac0f3a6d453e0e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type SpanAside_span$data = {
  readonly code: SpanStatusCode;
  readonly endTime: string | null;
  readonly id: string;
  readonly project: {
    readonly annotationConfigs: {
      readonly configs: ReadonlyArray<{
        readonly config: {
          readonly annotationType?: AnnotationType;
          readonly description?: string | null;
          readonly id?: string;
          readonly lowerBound?: number | null;
          readonly name?: string;
          readonly optimizationDirection?: OptimizationDirection;
          readonly upperBound?: number | null;
          readonly values?: ReadonlyArray<{
            readonly label: string;
            readonly score: number | null;
          }>;
        };
      }>;
    };
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigListProjectAnnotationConfigFragment">;
  };
  readonly startTime: string;
  readonly tokenCountCompletion: number | null;
  readonly tokenCountPrompt: number | null;
  readonly tokenCountTotal: number | null;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAsideAnnotationList_span">;
  readonly " $fragmentType": "SpanAside_span";
};
export type SpanAside_span$key = {
  readonly " $data"?: SpanAside_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAside_span">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterUserIds"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanAside_span",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "AnnotationConfigListProjectAnnotationConfigFragment"
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigConnection",
          "kind": "LinkedField",
          "name": "annotationConfigs",
          "plural": false,
          "selections": [
            {
              "alias": "configs",
              "args": null,
              "concreteType": "AnnotationConfigEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": "config",
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v0/*: any*/)
                      ],
                      "type": "Node",
                      "abstractKey": "__isNode"
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "description",
                          "storageKey": null
                        },
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
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "optimizationDirection",
                          "storageKey": null
                        }
                      ],
                      "type": "ContinuousAnnotationConfig",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*: any*/)
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
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "code",
      "args": null,
      "kind": "ScalarField",
      "name": "statusCode",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountPrompt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountCompletion",
      "storageKey": null
    },
    {
      "args": [
        {
          "kind": "Variable",
          "name": "filterUserIds",
          "variableName": "filterUserIds"
        }
      ],
      "kind": "FragmentSpread",
      "name": "SpanAsideAnnotationList_span"
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "86300485c06dbf731028f996f71b0b0a";

export default node;
