/**
 * @generated SignedSource<<94600849770d547449d5d7538cd137b3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateAnnotationConfigInput = {
  annotationConfig: AnnotationConfigInput;
  id: string;
};
export type AnnotationConfigInput = {
  categorical: CategoricalAnnotationConfigInput;
  continuous?: never;
  freeform?: never;
} | {
  categorical?: never;
  continuous: ContinuousAnnotationConfigInput;
  freeform?: never;
} | {
  categorical?: never;
  continuous?: never;
  freeform: FreeformAnnotationConfigInput;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection?: OptimizationDirection | null;
  threshold?: number | null;
  upperBound?: number | null;
};
export type updateAnnotationConfigToolMutation$variables = {
  input: UpdateAnnotationConfigInput;
};
export type updateAnnotationConfigToolMutation$data = {
  readonly updateAnnotationConfig: {
    readonly annotationConfig: {
      readonly __typename: "CategoricalAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      readonly __typename: "ContinuousAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      readonly __typename: "FreeformAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigTableFragment">;
    };
  };
};
export type updateAnnotationConfigToolMutation = {
  response: updateAnnotationConfigToolMutation$data;
  variables: updateAnnotationConfigToolMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
v5 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v6 = {
  "kind": "InlineFragment",
  "selections": (v5/*:: as any*/),
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": (v5/*:: as any*/),
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": (v5/*:: as any*/),
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "updateAnnotationConfigToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "updateAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "AnnotationConfigTableFragment"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "updateAnnotationConfigToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "updateAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
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
                          (v2/*:: as any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              (v10/*:: as any*/),
                              (v11/*:: as any*/),
                              (v12/*:: as any*/),
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
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              (v10/*:: as any*/),
                              (v11/*:: as any*/),
                              (v12/*:: as any*/),
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
                                "name": "lowerBound",
                                "storageKey": null
                              }
                            ],
                            "type": "ContinuousAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              (v10/*:: as any*/),
                              (v11/*:: as any*/),
                              (v12/*:: as any*/),
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
                          (v9/*:: as any*/)
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "410d6dd92fdf37f5d9f67c4452de1620",
    "id": null,
    "metadata": {},
    "name": "updateAnnotationConfigToolMutation",
    "operationKind": "mutation",
    "text": "mutation updateAnnotationConfigToolMutation(\n  $input: UpdateAnnotationConfigInput!\n) {\n  updateAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        id\n        name\n      }\n      ... on ContinuousAnnotationConfig {\n        id\n        name\n      }\n      ... on FreeformAnnotationConfig {\n        id\n        name\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    query {\n      ...AnnotationConfigTableFragment\n    }\n  }\n}\n\nfragment AnnotationConfigTableFragment on Query {\n  annotationConfigs {\n    edges {\n      annotationConfig: node {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          upperBound\n          lowerBound\n        }\n        ... on FreeformAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab46cb5c95297a5326c8ea0cbc5a18b4";

export default node;
