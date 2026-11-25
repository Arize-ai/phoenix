/**
 * @generated SignedSource<<0aa31a0aa83217fc42de3c996b11b3f4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorColumn = "createdAt" | "kind" | "name" | "updatedAt";
export type DatasetEvaluatorFilterColumn = "name";
export type SortDir = "asc" | "desc";
export type DatasetEvaluatorFilter = {
  col: DatasetEvaluatorFilterColumn;
  value: string;
};
export type DatasetEvaluatorSort = {
  col: DatasetEvaluatorColumn;
  dir: SortDir;
};
export type DatasetEvaluatorsTabTableQuery$variables = {
  after?: string | null;
  filter?: DatasetEvaluatorFilter | null;
  first?: number | null;
  sort?: DatasetEvaluatorSort | null;
};
export type DatasetEvaluatorsTabTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTabTable_datasetEvaluators">;
};
export type DatasetEvaluatorsTabTableQuery = {
  response: DatasetEvaluatorsTabTableQuery$data;
  variables: DatasetEvaluatorsTabTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sort"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
],
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
  "name": "updatedAt",
  "storageKey": null
},
v5 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = [
  (v3/*:: as any*/),
  (v2/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetEvaluatorsTabTableQuery",
    "selections": [
      {
        "args": (v1/*:: as any*/),
        "kind": "FragmentSpread",
        "name": "DatasetEvaluatorsTabTable_datasetEvaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DatasetEvaluatorsTabTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
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
                      (v2/*:: as any*/)
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
                    "selections": (v5/*:: as any*/),
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
                      (v6/*:: as any*/),
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
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
                      (v4/*:: as any*/),
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
                            "selections": (v5/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v7/*:: as any*/),
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
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              (v2/*:: as any*/)
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
                            "concreteType": "DecisionVersionTag",
                            "kind": "LinkedField",
                            "name": "decisionVersionTag",
                            "plural": false,
                            "selections": (v7/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersion",
                            "kind": "LinkedField",
                            "name": "decisionVersion",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
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
                                "selections": (v7/*:: as any*/),
                                "storageKey": null
                              },
                              (v8/*:: as any*/),
                              (v9/*:: as any*/)
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
                              (v2/*:: as any*/),
                              (v3/*:: as any*/),
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
                                  (v2/*:: as any*/)
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
                  (v6/*:: as any*/)
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
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
    "cacheID": "d66633226136ba9c10a41b4973e72860",
    "id": null,
    "metadata": {},
    "name": "DatasetEvaluatorsTabTableQuery",
    "operationKind": "query",
    "text": "query DatasetEvaluatorsTabTableQuery(\n  $after: String = null\n  $filter: DatasetEvaluatorFilter = null\n  $first: Int = 100\n  $sort: DatasetEvaluatorSort = null\n) {\n  ...DatasetEvaluatorsTabTable_datasetEvaluators_3JsJJ3\n}\n\nfragment DatasetEvaluatorsTabTable_datasetEvaluators_3JsJJ3 on Query {\n  datasetEvaluators(first: $first, after: $after, sort: $sort, filter: $filter) {\n    edges {\n      node {\n        ...DatasetEvaluatorsTable_row\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  dataset {\n    id\n    name\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersionTag {\n        name\n        id\n      }\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d3c3b799b93798584f349a664590120b";

export default node;
