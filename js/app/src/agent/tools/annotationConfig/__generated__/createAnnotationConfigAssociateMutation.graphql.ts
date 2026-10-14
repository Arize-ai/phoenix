/**
 * @generated SignedSource<<b0815e300a29d88c140453d67f86667a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AddAnnotationConfigToProjectInput = {
  annotationConfigId: string;
  projectId: string;
};
export type createAnnotationConfigAssociateMutation$variables = {
  input: ReadonlyArray<AddAnnotationConfigToProjectInput>;
  projectId: string;
};
export type createAnnotationConfigAssociateMutation$data = {
  readonly addAnnotationConfigToProject: {
    readonly query: {
      readonly projectNode: {
        readonly id?: string;
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigListProjectAnnotationConfigFragment" | "ProjectAnnotationConfigCardContent_project_annotations">;
      };
    };
  };
};
export type createAnnotationConfigAssociateMutation = {
  response: createAnnotationConfigAssociateMutation$data;
  variables: createAnnotationConfigAssociateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
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
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
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
  "name": "annotationType",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v9 = {
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
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v13 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v14 = [
  (v4/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          (v8/*:: as any*/),
          (v9/*:: as any*/)
        ],
        "type": "CategoricalAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v8/*:: as any*/),
          (v10/*:: as any*/),
          (v11/*:: as any*/)
        ],
        "type": "ContinuousAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v8/*:: as any*/),
          (v12/*:: as any*/),
          (v10/*:: as any*/),
          (v11/*:: as any*/)
        ],
        "type": "FreeformAnnotationConfig",
        "abstractKey": null
      }
    ],
    "type": "AnnotationConfigBase",
    "abstractKey": "__isAnnotationConfigBase"
  },
  (v13/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createAnnotationConfigAssociateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "AddAnnotationConfigToProjectPayload",
        "kind": "LinkedField",
        "name": "addAnnotationConfigToProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "projectNode",
                "args": (v2/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "AnnotationConfigListProjectAnnotationConfigFragment"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "ProjectAnnotationConfigCardContent_project_annotations"
                      }
                    ],
                    "type": "Project",
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createAnnotationConfigAssociateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "AddAnnotationConfigToProjectPayload",
        "kind": "LinkedField",
        "name": "addAnnotationConfigToProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "projectNode",
                "args": (v2/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": [
                          {
                            "fields": [
                              {
                                "kind": "Literal",
                                "name": "annotationNames",
                                "value": null
                              }
                            ],
                            "kind": "ObjectValue",
                            "name": "filter"
                          },
                          (v5/*:: as any*/)
                        ],
                        "concreteType": "ProjectEvaluatorConnection",
                        "kind": "LinkedField",
                        "name": "evaluators",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ProjectEvaluatorEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ProjectEvaluator",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v6/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "evaluator",
                                    "plural": false,
                                    "selections": [
                                      (v4/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "outputConfigs",
                                        "plural": true,
                                        "selections": (v14/*:: as any*/),
                                        "storageKey": null
                                      },
                                      (v3/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  (v3/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": "evaluators(filter:{\"annotationNames\":null},first:100)"
                      },
                      {
                        "alias": "configsByName",
                        "args": [
                          (v5/*:: as any*/)
                        ],
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
                                "alias": "config",
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": (v14/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": "annotationConfigs(first:100)"
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
                                  (v4/*:: as any*/),
                                  (v13/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v6/*:: as any*/),
                                      (v7/*:: as any*/),
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
                                      (v9/*:: as any*/)
                                    ],
                                    "type": "CategoricalAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v10/*:: as any*/),
                                      (v11/*:: as any*/),
                                      (v8/*:: as any*/)
                                    ],
                                    "type": "ContinuousAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v6/*:: as any*/),
                                      (v8/*:: as any*/),
                                      (v12/*:: as any*/)
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
    "cacheID": "af60f6bfbbd211fd06454a9298111cd4",
    "id": null,
    "metadata": {},
    "name": "createAnnotationConfigAssociateMutation",
    "operationKind": "mutation",
    "text": "mutation createAnnotationConfigAssociateMutation(\n  $input: [AddAnnotationConfigToProjectInput!]!\n  $projectId: ID!\n) {\n  addAnnotationConfigToProject(input: $input) {\n    query {\n      projectNode: node(id: $projectId) {\n        __typename\n        ... on Project {\n          id\n          ...AnnotationConfigListProjectAnnotationConfigFragment\n          ...ProjectAnnotationConfigCardContent_project_annotations\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationConfigListProjectAnnotationConfigFragment on Project {\n  ...ProjectAnnotationConfigsByNameFragment\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n          description\n        }\n        ... on CategoricalAnnotationConfig {\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          lowerBound\n          upperBound\n          optimizationDirection\n        }\n        ... on FreeformAnnotationConfig {\n          name\n          optimizationDirection\n          threshold\n        }\n      }\n    }\n  }\n}\n\nfragment ProjectAnnotationConfigCardContent_project_annotations on Project {\n  ...ProjectAnnotationConfigsByNameFragment\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n  id\n}\n\nfragment ProjectAnnotationConfigsByNameFragment on Project {\n  evaluators(first: 100, filter: {}) {\n    edges {\n      node {\n        name\n        evaluator {\n          __typename\n          outputConfigs {\n            __typename\n            ...useProjectAnnotationConfigsByName_config\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n  configsByName: annotationConfigs(first: 100) {\n    edges {\n      config: node {\n        __typename\n        ...useProjectAnnotationConfigsByName_config\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  name\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    optimizationDirection\n    lowerBound\n    upperBound\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n    lowerBound\n    upperBound\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ad2aa75671597372c0d42bdb315a125";

export default node;
