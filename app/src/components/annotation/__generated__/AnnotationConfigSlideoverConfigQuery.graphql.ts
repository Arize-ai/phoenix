/**
 * @generated SignedSource<<2c90202cb941b1609998904c354a24c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type AnnotationConfigSlideoverConfigQuery$variables = {
  projectId: string;
};
export type AnnotationConfigSlideoverConfigQuery$data = {
  readonly node: {
    readonly __typename: "Project";
    readonly annotationConfigs: {
      readonly edges: ReadonlyArray<{
        readonly annotationConfig: {
          readonly __typename: "CategoricalAnnotationConfig";
          readonly annotationType: AnnotationType;
          readonly description: string | null;
          readonly id: string;
          readonly name: string;
          readonly optimizationDirection: OptimizationDirection;
          readonly values: ReadonlyArray<{
            readonly label: string;
            readonly score: number | null;
          }>;
        } | {
          readonly __typename: "ContinuousAnnotationConfig";
          readonly annotationType: AnnotationType;
          readonly description: string | null;
          readonly id: string;
          readonly lowerBound: number | null;
          readonly name: string;
          readonly optimizationDirection: OptimizationDirection;
          readonly upperBound: number | null;
        } | {
          readonly __typename: "FreeformAnnotationConfig";
          readonly annotationType: AnnotationType;
          readonly description: string | null;
          readonly id: string;
          readonly name: string;
          readonly optimizationDirection: OptimizationDirection;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type AnnotationConfigSlideoverConfigQuery = {
  response: AnnotationConfigSlideoverConfigQuery$data;
  variables: AnnotationConfigSlideoverConfigQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
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
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    (v6/*: any*/),
    (v7/*: any*/),
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
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    (v6/*: any*/),
    (v7/*: any*/),
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
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    (v6/*: any*/),
    (v7/*: any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationConfigSlideoverConfigQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
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
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "annotationConfig",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AnnotationConfigSlideoverConfigQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
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
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "annotationConfig",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*: any*/)
                            ],
                            "type": "Node",
                            "abstractKey": "__isNode"
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
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e8e301ad1d173b98c4a24fb43f2be105",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigSlideoverConfigQuery",
    "operationKind": "query",
    "text": "query AnnotationConfigSlideoverConfigQuery(\n  $projectId: ID!\n) {\n  node(id: $projectId) {\n    __typename\n    ... on Project {\n      annotationConfigs {\n        edges {\n          annotationConfig: node {\n            __typename\n            ... on CategoricalAnnotationConfig {\n              id\n              name\n              description\n              annotationType\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              id\n              name\n              description\n              annotationType\n              optimizationDirection\n              lowerBound\n              upperBound\n            }\n            ... on FreeformAnnotationConfig {\n              id\n              name\n              description\n              annotationType\n              optimizationDirection\n            }\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e14e21113107cb8ca1d8a6619dcbf73d";

export default node;
