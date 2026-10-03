/**
 * @generated SignedSource<<419cb971bdc8387df9f8ca8fb51887a8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type evaluatorsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type evaluatorsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"GlobalEvaluatorsTable_evaluators">;
};
export type evaluatorsPageLoaderQuery = {
  response: evaluatorsPageLoaderQuery$data;
  variables: evaluatorsPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
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
  "name": "updatedAt",
  "storageKey": null
},
v7 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 10
  }
],
v8 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
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
    },
    (v2/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "evaluatorsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GlobalEvaluatorsTable_evaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "evaluatorsPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
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
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isEvaluator"
                  },
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": (v7/*:: as any*/),
                    "concreteType": "DatasetConnection",
                    "kind": "LinkedField",
                    "name": "datasets",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Dataset",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": (v8/*:: as any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "datasets(first:10)"
                  },
                  {
                    "alias": null,
                    "args": (v7/*:: as any*/),
                    "concreteType": "ProjectConnection",
                    "kind": "LinkedField",
                    "name": "projects",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "gradientStartColor",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "gradientEndColor",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "projects(first:10)"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluator",
                    "kind": "LinkedField",
                    "name": "datasetEvaluators",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "evaluator",
                        "plural": false,
                        "selections": [
                          (v1/*:: as any*/),
                          (v4/*:: as any*/),
                          (v2/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v3/*:: as any*/),
                      (v5/*:: as any*/),
                      (v6/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Dataset",
                        "kind": "LinkedField",
                        "name": "dataset",
                        "plural": false,
                        "selections": (v8/*:: as any*/),
                        "storageKey": null
                      },
                      (v9/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Prompt",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": (v8/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v2/*:: as any*/)
                        ],
                        "storageKey": null
                      },
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
                            "kind": "ScalarField",
                            "name": "modelName",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelProvider",
                            "storageKey": null
                          },
                          (v2/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v9/*:: as any*/)
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v9/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__id",
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": "evaluators(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "EvaluatorsTable_evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "4bfa6ac4f366df53cba20016d0e689fd",
    "id": null,
    "metadata": {},
    "name": "evaluatorsPageLoaderQuery",
    "operationKind": "query",
    "text": "query evaluatorsPageLoaderQuery {\n  ...GlobalEvaluatorsTable_evaluators\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  datasets(first: 10) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n  projects(first: 10) {\n    edges {\n      node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n      }\n    }\n  }\n  datasetEvaluators {\n    id\n    evaluator {\n      __typename\n      kind\n      id\n    }\n    name\n    description\n    updatedAt\n    dataset {\n      id\n      name\n    }\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    promptVersionTag {\n      name\n      id\n    }\n    promptVersion {\n      modelName\n      modelProvider\n      id\n    }\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  ... on CodeEvaluator {\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n}\n\nfragment GlobalEvaluatorsTable_evaluators on Query {\n  evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        ...EvaluatorsTable_row\n        id\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "53b1973dff23e5476cd644dee57048fb";

export default node;
