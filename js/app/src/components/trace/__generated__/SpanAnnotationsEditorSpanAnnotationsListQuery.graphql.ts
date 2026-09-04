/**
 * @generated SignedSource<<d88cb6970de8138b8a6e65656c23e292>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type SpanAnnotationsEditorSpanAnnotationsListQuery$variables = {
  filterUserIds?: ReadonlyArray<string | null> | null;
  projectId: string;
  spanId: string;
};
export type SpanAnnotationsEditorSpanAnnotationsListQuery$data = {
  readonly project: {
    readonly annotationConfigs?: {
      readonly configs: ReadonlyArray<{
        readonly config: {
          readonly __typename: string;
          readonly annotationType?: AnnotationType;
          readonly description?: string | null;
          readonly id?: string;
          readonly lowerBound?: number | null;
          readonly name?: string;
          readonly optimizationDirection?: OptimizationDirection;
          readonly threshold?: number | null;
          readonly upperBound?: number | null;
          readonly values?: ReadonlyArray<{
            readonly label: string;
            readonly score: number | null;
          }>;
        };
      }>;
    };
    readonly id: string;
  };
  readonly span: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_spanAnnotations">;
  };
};
export type SpanAnnotationsEditorSpanAnnotationsListQuery = {
  response: SpanAnnotationsEditorSpanAnnotationsListQuery$data;
  variables: SpanAnnotationsEditorSpanAnnotationsListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterUserIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v10 = {
  "kind": "InlineFragment",
  "selections": [
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
                (v5/*:: as any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v4/*:: as any*/)
                  ],
                  "type": "Node",
                  "abstractKey": "__isNode"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v6/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotationType",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    }
                  ],
                  "type": "AnnotationConfigBase",
                  "abstractKey": "__isAnnotationConfigBase"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v7/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CategoricalAnnotationValue",
                      "kind": "LinkedField",
                      "name": "values",
                      "plural": true,
                      "selections": [
                        (v8/*:: as any*/),
                        (v9/*:: as any*/)
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
                    (v7/*:: as any*/)
                  ],
                  "type": "ContinuousAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v6/*:: as any*/),
                    (v7/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "threshold",
                      "storageKey": null
                    }
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
  "type": "Project",
  "abstractKey": null
},
v11 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorSpanAnnotationsListQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v10/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v11/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": [
                  {
                    "kind": "Variable",
                    "name": "filterUserIds",
                    "variableName": "filterUserIds"
                  }
                ],
                "kind": "FragmentSpread",
                "name": "SpanAnnotationsEditor_spanAnnotations"
              }
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorSpanAnnotationsListQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          (v4/*:: as any*/),
          (v10/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v11/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "filteredSpanAnnotations",
                "args": [
                  {
                    "fields": [
                      {
                        "kind": "Literal",
                        "name": "exclude",
                        "value": {
                          "names": [
                            "note"
                          ]
                        }
                      },
                      {
                        "fields": [
                          {
                            "kind": "Variable",
                            "name": "userIds",
                            "variableName": "filterUserIds"
                          }
                        ],
                        "kind": "ObjectValue",
                        "name": "include"
                      }
                    ],
                    "kind": "ObjectValue",
                    "name": "filter"
                  }
                ],
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "annotatorKind",
                    "storageKey": null
                  },
                  (v9/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "explanation",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4adc54d72ab0e92f66d2ad0599e16db8",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorSpanAnnotationsListQuery",
    "operationKind": "query",
    "text": "query SpanAnnotationsEditorSpanAnnotationsListQuery(\n  $projectId: ID!\n  $spanId: ID!\n  $filterUserIds: [ID]\n) {\n  project: node(id: $projectId) {\n    __typename\n    id\n    ... on Project {\n      annotationConfigs {\n        configs: edges {\n          config: node {\n            __typename\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n            ... on AnnotationConfigBase {\n              __isAnnotationConfigBase: __typename\n              name\n              annotationType\n              description\n            }\n            ... on CategoricalAnnotationConfig {\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              lowerBound\n              upperBound\n              optimizationDirection\n            }\n            ... on FreeformAnnotationConfig {\n              name\n              optimizationDirection\n              threshold\n            }\n          }\n        }\n      }\n    }\n  }\n  span: node(id: $spanId) {\n    __typename\n    id\n    ... on Span {\n      ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "fcdb575be7698d1d299d462437f0693d";

export default node;
