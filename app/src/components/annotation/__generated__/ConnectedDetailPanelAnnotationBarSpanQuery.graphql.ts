/**
 * @generated SignedSource<<27fcd0925a525fb9be51f124ff322f7c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarSpanQuery$variables = {
  id: string;
};
export type ConnectedDetailPanelAnnotationBarSpanQuery$data = {
  readonly allAnnotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarConfigFields">;
      };
    }>;
  };
  readonly span: {
    readonly __typename: "Span";
    readonly id: string;
    readonly project: {
      readonly annotationConfigs: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarConfigFields">;
          };
        }>;
      };
      readonly id: string;
      readonly name: string;
    };
    readonly spanAnnotations: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarAnnotationFields">;
    }>;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type ConnectedDetailPanelAnnotationBarSpanQuery = {
  response: ConnectedDetailPanelAnnotationBarSpanQuery$data;
  variables: ConnectedDetailPanelAnnotationBarSpanQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
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
v11 = {
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
v12 = {
  "kind": "InlineFragment",
  "selections": [
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
},
v13 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AnnotationConfigEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "ConnectedDetailPanelAnnotationBarConfigFields",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v1/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/)
                ],
                "type": "AnnotationConfigBase",
                "abstractKey": "__isAnnotationConfigBase"
              }
            ],
            "args": null,
            "argumentDefinitions": ([]/*:: as any*/)
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v14 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "source",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "identifier",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "username",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "profilePictureUrl",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v23 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AnnotationConfigEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v3/*:: as any*/),
              (v10/*:: as any*/),
              (v11/*:: as any*/),
              (v12/*:: as any*/)
            ],
            "type": "AnnotationConfigBase",
            "abstractKey": "__isAnnotationConfigBase"
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ConnectedDetailPanelAnnotationBarSpanQuery",
    "selections": [
      {
        "alias": "allAnnotationConfigs",
        "args": null,
        "concreteType": "AnnotationConfigConnection",
        "kind": "LinkedField",
        "name": "annotationConfigs",
        "plural": false,
        "selections": (v13/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v14/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "project",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigConnection",
                    "kind": "LinkedField",
                    "name": "annotationConfigs",
                    "plural": false,
                    "selections": (v13/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "ConnectedDetailPanelAnnotationBarAnnotationFields",
                    "selections": [
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          (v17/*:: as any*/),
                          (v18/*:: as any*/),
                          (v19/*:: as any*/),
                          (v20/*:: as any*/),
                          (v21/*:: as any*/),
                          (v22/*:: as any*/)
                        ],
                        "type": "Annotation",
                        "abstractKey": "__isAnnotation"
                      }
                    ],
                    "args": null,
                    "argumentDefinitions": []
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
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarSpanQuery",
    "selections": [
      {
        "alias": "allAnnotationConfigs",
        "args": null,
        "concreteType": "AnnotationConfigConnection",
        "kind": "LinkedField",
        "name": "annotationConfigs",
        "plural": false,
        "selections": (v23/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v14/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "project",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigConnection",
                    "kind": "LinkedField",
                    "name": "annotationConfigs",
                    "plural": false,
                    "selections": (v23/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*:: as any*/),
                      (v8/*:: as any*/),
                      (v9/*:: as any*/),
                      (v15/*:: as any*/),
                      (v16/*:: as any*/),
                      (v17/*:: as any*/),
                      (v18/*:: as any*/),
                      (v19/*:: as any*/),
                      (v20/*:: as any*/),
                      (v21/*:: as any*/),
                      (v22/*:: as any*/),
                      {
                        "kind": "TypeDiscriminator",
                        "abstractKey": "__isNode"
                      }
                    ],
                    "type": "Annotation",
                    "abstractKey": "__isAnnotation"
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
    "cacheID": "4cac733e9eb846da856ef58fafab0688",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarSpanQuery",
    "operationKind": "query",
    "text": "query ConnectedDetailPanelAnnotationBarSpanQuery(\n  $id: ID!\n) {\n  allAnnotationConfigs: annotationConfigs {\n    edges {\n      node {\n        __typename\n        ...ConnectedDetailPanelAnnotationBarConfigFields\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n  span: node(id: $id) {\n    __typename\n    ... on Span {\n      id\n      project {\n        id\n        name\n        annotationConfigs {\n          edges {\n            node {\n              __typename\n              ...ConnectedDetailPanelAnnotationBarConfigFields\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n          }\n        }\n      }\n      spanAnnotations {\n        ...ConnectedDetailPanelAnnotationBarAnnotationFields\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarAnnotationFields on Annotation {\n  __isAnnotation: __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  label\n  score\n  explanation\n  metadata\n  annotatorKind\n  source\n  identifier\n  createdAt\n  updatedAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarConfigFields on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  description\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    lowerBound\n    upperBound\n    optimizationDirection\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n  }\n}\n"
  }
};
})();

(node as any).hash = "b4e6f1df86b674a4133e5ef9fa23c83a";

export default node;
