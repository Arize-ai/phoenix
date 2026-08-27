/**
 * @generated SignedSource<<9805c63fa714557fa01430c48490bdc4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorFilterColumn = "name";
export type ProjectEvaluatorFilter = {
  col: ProjectEvaluatorFilterColumn;
  value: string;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorsPageQuery$variables = {
  filter?: ProjectEvaluatorFilter | null;
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectEvaluatorsPageQuery$data = {
  readonly project: {
    readonly evaluatorCount?: number;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_project">;
  };
};
export type ProjectEvaluatorsPageQuery = {
  response: ProjectEvaluatorsPageQuery$data;
  variables: ProjectEvaluatorsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
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
  "name": "evaluatorCount",
  "storageKey": null
},
v5 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v6 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = [
  (v5/*:: as any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 30
  }
],
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v11 = [
  (v6/*:: as any*/)
],
v12 = [
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
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorsPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "args": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/)
                ],
                "kind": "FragmentSpread",
                "name": "ProjectEvaluatorsTable_project"
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
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorsPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": (v9/*:: as any*/),
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
                          (v8/*:: as any*/),
                          (v10/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "evaluationTarget",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "filterCondition",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "samplingRate",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "schedulabilityStatus",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "enabled",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "schedulabilityReason",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ProjectEvaluatorRunSummary",
                            "kind": "LinkedField",
                            "name": "runSummary",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "status",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "lastRunAt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "queuedCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "evaluatedCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "failedCount",
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
                              (v7/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "kind",
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
                                    "selections": [
                                      (v8/*:: as any*/),
                                      (v10/*:: as any*/)
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
                                      (v10/*:: as any*/),
                                      (v8/*:: as any*/)
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
                                      (v8/*:: as any*/)
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
                                      (v8/*:: as any*/),
                                      (v10/*:: as any*/),
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
                                          (v8/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "CodeEvaluator",
                                "abstractKey": null
                              },
                              (v8/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "traceProject",
                            "plural": false,
                            "selections": [
                              (v8/*:: as any*/),
                              {
                                "alias": null,
                                "args": (v11/*:: as any*/),
                                "kind": "ScalarField",
                                "name": "traceCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": (v11/*:: as any*/),
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
                                    "selections": (v12/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": (v12/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "completion",
                                    "plural": false,
                                    "selections": (v12/*:: as any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v7/*:: as any*/)
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
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v9/*:: as any*/),
                "filters": [
                  "filter"
                ],
                "handle": "connection",
                "key": "ProjectEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dfe5c7d8668d466ef26001cf4189c5b2",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorsPageQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorsPageQuery(\n  $projectId: ID!\n  $filter: ProjectEvaluatorFilter\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorCount\n      ...ProjectEvaluatorsTable_project_3yoAX2\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorsTable_costs_3E0ZE6 on ProjectEvaluator {\n  traceProject {\n    id\n    traceCount(timeRange: $timeRange)\n    costSummary(timeRange: $timeRange) {\n      total {\n        cost\n      }\n      prompt {\n        cost\n      }\n      completion {\n        cost\n      }\n    }\n  }\n}\n\nfragment ProjectEvaluatorsTable_project_3yoAX2 on Project {\n  evaluators(first: 30, filter: $filter) {\n    edges {\n      node {\n        ...ProjectEvaluatorsTable_row\n        ...ProjectEvaluatorsTable_costs_3E0ZE6\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment ProjectEvaluatorsTable_row on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  filterCondition\n  samplingRate\n  schedulabilityStatus\n  enabled\n  updatedAt\n  schedulabilityReason\n  runSummary {\n    status\n    lastRunAt\n    queuedCount\n    evaluatedCount\n    failedCount\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5feeb271094e288e1cd6ed6539b2fef8";

export default node;
