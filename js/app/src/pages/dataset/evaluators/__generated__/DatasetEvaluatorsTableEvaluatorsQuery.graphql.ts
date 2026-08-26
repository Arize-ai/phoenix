/**
 * @generated SignedSource<<4b02fb586373bafd76849418d9539ce2>>
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
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type DatasetEvaluatorFilter = {
  col: DatasetEvaluatorFilterColumn;
  value: string;
};
export type DatasetEvaluatorSort = {
  col: DatasetEvaluatorColumn;
  dir: SortDir;
};
export type DatasetEvaluatorsTableEvaluatorsQuery$variables = {
  after?: string | null;
  costTimeRange?: TimeRange | null;
  filter?: DatasetEvaluatorFilter | null;
  first?: number | null;
  id: string;
  sort?: DatasetEvaluatorSort | null;
};
export type DatasetEvaluatorsTableEvaluatorsQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_evaluators">;
  };
};
export type DatasetEvaluatorsTableEvaluatorsQuery = {
  response: DatasetEvaluatorsTableEvaluatorsQuery$data;
  variables: DatasetEvaluatorsTableEvaluatorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "costTimeRange"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v3 = {
  "defaultValue": 100,
  "kind": "LocalArgument",
  "name": "first"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v6 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v7 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v8 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v9 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v10 = {
  "kind": "Variable",
  "name": "sort",
  "variableName": "sort"
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v13 = [
  (v7/*:: as any*/),
  (v8/*:: as any*/),
  (v9/*:: as any*/),
  (v10/*:: as any*/)
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v16 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetEvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              (v7/*:: as any*/),
              {
                "kind": "Variable",
                "name": "costTimeRange",
                "variableName": "costTimeRange"
              },
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/)
            ],
            "kind": "FragmentSpread",
            "name": "DatasetEvaluatorsTable_evaluators"
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v5/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "DatasetEvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/),
          (v12/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v13/*:: as any*/),
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
                          (v12/*:: as any*/),
                          (v14/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "description",
                            "storageKey": null
                          },
                          (v15/*:: as any*/),
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
                              (v12/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "project",
                            "plural": false,
                            "selections": [
                              (v12/*:: as any*/),
                              {
                                "alias": null,
                                "args": [
                                  {
                                    "kind": "Variable",
                                    "name": "timeRange",
                                    "variableName": "costTimeRange"
                                  }
                                ],
                                "concreteType": "SpanCostSummary",
                                "kind": "LinkedField",
                                "name": "costSummary",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "total",
                                    "plural": false,
                                    "selections": (v16/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": (v16/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "completion",
                                    "plural": false,
                                    "selections": (v16/*:: as any*/),
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
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v11/*:: as any*/),
                              (v12/*:: as any*/),
                              (v14/*:: as any*/),
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
                              (v15/*:: as any*/),
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
                                    "selections": [
                                      (v12/*:: as any*/),
                                      (v14/*:: as any*/)
                                    ],
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
                                      (v14/*:: as any*/),
                                      (v12/*:: as any*/)
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
                                      (v12/*:: as any*/)
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
                                      (v12/*:: as any*/),
                                      (v14/*:: as any*/),
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
                                          (v12/*:: as any*/)
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
                          (v11/*:: as any*/)
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
                "args": (v13/*:: as any*/),
                "filters": [
                  "sort",
                  "filter"
                ],
                "handle": "connection",
                "key": "DatasetEvaluatorsTable_datasetEvaluators",
                "kind": "LinkedHandle",
                "name": "datasetEvaluators"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "eaf948086cf9be3bf3859e130083864a",
    "id": null,
    "metadata": {},
    "name": "DatasetEvaluatorsTableEvaluatorsQuery",
    "operationKind": "query",
    "text": "query DatasetEvaluatorsTableEvaluatorsQuery(\n  $after: String = null\n  $costTimeRange: TimeRange\n  $filter: DatasetEvaluatorFilter = null\n  $first: Int = 100\n  $sort: DatasetEvaluatorSort = null\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...DatasetEvaluatorsTable_evaluators_Nw8hk\n    id\n  }\n}\n\nfragment DatasetEvaluatorsTable_evaluators_Nw8hk on Dataset {\n  datasetEvaluators(first: $first, after: $after, sort: $sort, filter: $filter) {\n    edges {\n      node {\n        ...DatasetEvaluatorsTable_row_2WJEbX\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment DatasetEvaluatorsTable_row_2WJEbX on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  project {\n    id\n    costSummary(timeRange: $costTimeRange) {\n      total {\n        cost\n      }\n      prompt {\n        cost\n      }\n      completion {\n        cost\n      }\n    }\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cc84d1b492249e49c001aa1619fda62f";

export default node;
