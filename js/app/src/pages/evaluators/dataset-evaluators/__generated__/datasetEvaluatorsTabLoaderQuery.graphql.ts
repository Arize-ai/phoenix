/**
 * @generated SignedSource<<dcc98bca3029977c57336aa5cde11d5b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type datasetEvaluatorsTabLoaderQuery$variables = Record<PropertyKey, never>;
export type datasetEvaluatorsTabLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTabTable_datasetEvaluators">;
};
export type datasetEvaluatorsTabLoaderQuery = {
  response: datasetEvaluatorsTabLoaderQuery$data;
  variables: datasetEvaluatorsTabLoaderQuery$variables;
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
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v4 = [
  (v1/*:: as any*/),
  (v2/*:: as any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = [
  (v2/*:: as any*/),
  (v1/*:: as any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetEvaluatorsTabLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetEvaluatorsTabTable_datasetEvaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "datasetEvaluatorsTabLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DatasetEvaluatorConnection",
        "kind": "LinkedField",
        "name": "datasetEvaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  (v3/*:: as any*/),
                  {
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
                      (v1/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Dataset",
                    "kind": "LinkedField",
                    "name": "dataset",
                    "plural": false,
                    "selections": (v4/*:: as any*/),
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
                      (v5/*:: as any*/),
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "kind",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "createdAt",
                        "storageKey": null
                      },
                      (v3/*:: as any*/),
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
                            "selections": (v4/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v6/*:: as any*/),
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
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              (v1/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersion",
                            "kind": "LinkedField",
                            "name": "decisionVersion",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "decisionId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Decision",
                                "kind": "LinkedField",
                                "name": "decision",
                                "plural": false,
                                "selections": (v6/*:: as any*/),
                                "storageKey": null
                              },
                              (v7/*:: as any*/),
                              (v8/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "DecisionEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "language",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
                              (v2/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "backendType",
                                    "storageKey": null
                                  },
                                  (v1/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "CodeEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v5/*:: as any*/)
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
          }
        ],
        "storageKey": "datasetEvaluators(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "DatasetEvaluatorsTabTable_datasetEvaluators",
        "kind": "LinkedHandle",
        "name": "datasetEvaluators"
      }
    ]
  },
  "params": {
    "cacheID": "142cdd16c650ae2603fdff919261d39f",
    "id": null,
    "metadata": {},
    "name": "datasetEvaluatorsTabLoaderQuery",
    "operationKind": "query",
    "text": "query datasetEvaluatorsTabLoaderQuery {\n  ...DatasetEvaluatorsTabTable_datasetEvaluators\n}\n\nfragment DatasetEvaluatorsTabTable_datasetEvaluators on Query {\n  datasetEvaluators(first: 100) {\n    edges {\n      node {\n        ...DatasetEvaluatorsTable_row\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  dataset {\n    id\n    name\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5eb2ff551201e8e4faf6eb29db68ffec";

export default node;
