/**
 * @generated SignedSource<<21ade129a4b544132197f94f13ce651d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorColumn = "createdAt" | "kind" | "name" | "updatedAt";
export type EvaluatorFilterColumn = "name";
export type SortDir = "asc" | "desc";
export type EvaluatorFilter = {
  col: EvaluatorFilterColumn;
  value: string;
};
export type EvaluatorSort = {
  col: EvaluatorColumn;
  dir: SortDir;
};
export type GlobalEvaluatorsTableEvaluatorsQuery$variables = {
  after?: string | null;
  filter?: EvaluatorFilter | null;
  first?: number | null;
  sort?: EvaluatorSort | null;
};
export type GlobalEvaluatorsTableEvaluatorsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"GlobalEvaluatorsTable_evaluators">;
};
export type GlobalEvaluatorsTableEvaluatorsQuery = {
  response: GlobalEvaluatorsTableEvaluatorsQuery$data;
  variables: GlobalEvaluatorsTableEvaluatorsQuery$variables;
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
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 10
  }
],
v7 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/)
],
v8 = {
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "GlobalEvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "args": (v1/*:: as any*/),
        "kind": "FragmentSpread",
        "name": "GlobalEvaluatorsTable_evaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "GlobalEvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isEvaluator"
                  },
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "kind",
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": (v6/*:: as any*/),
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
                            "selections": (v7/*:: as any*/),
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
                    "args": (v6/*:: as any*/),
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
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Dataset",
                        "kind": "LinkedField",
                        "name": "dataset",
                        "plural": false,
                        "selections": (v7/*:: as any*/),
                        "storageKey": null
                      },
                      (v8/*:: as any*/)
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
                        "selections": (v7/*:: as any*/),
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
                      (v8/*:: as any*/)
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v8/*:: as any*/)
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
        "key": "EvaluatorsTable_evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "4ce9661bcdb676a3e61710b3add96ed2",
    "id": null,
    "metadata": {},
    "name": "GlobalEvaluatorsTableEvaluatorsQuery",
    "operationKind": "query",
    "text": "query GlobalEvaluatorsTableEvaluatorsQuery(\n  $after: String = null\n  $filter: EvaluatorFilter = null\n  $first: Int = 100\n  $sort: EvaluatorSort = null\n) {\n  ...GlobalEvaluatorsTable_evaluators_3JsJJ3\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  datasets(first: 10) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n  projects(first: 10) {\n    edges {\n      node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n      }\n    }\n  }\n  datasetEvaluators {\n    id\n    name\n    description\n    updatedAt\n    dataset {\n      id\n      name\n    }\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    promptVersionTag {\n      name\n      id\n    }\n    promptVersion {\n      modelName\n      modelProvider\n      id\n    }\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  ... on CodeEvaluator {\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n}\n\nfragment GlobalEvaluatorsTable_evaluators_3JsJJ3 on Query {\n  evaluators(first: $first, after: $after, sort: $sort, filter: $filter) {\n    edges {\n      node {\n        __typename\n        ...EvaluatorsTable_row\n        id\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ed29a29e1ac93825119bff4ac197a1f2";

export default node;
