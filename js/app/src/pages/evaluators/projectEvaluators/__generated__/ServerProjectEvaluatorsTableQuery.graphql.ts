/**
 * @generated SignedSource<<a0de101c8d9e3c6255199f958a6118fe>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "QUEUED" | "RUNNING";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ServerProjectEvaluatorsTableQuery$variables = {
  first: number;
  timeRange: TimeRange;
};
export type ServerProjectEvaluatorsTableQuery$data = {
  readonly evaluationQueue: {
    readonly queuedCount: number;
    readonly status: EvaluationQueueStatus;
  };
  readonly projectEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly enabled: boolean;
        readonly evaluationLoad: {
          readonly evaluationCount: number;
          readonly meanEvaluationSeconds: number | null;
          readonly shareOfEvaluationTime: number | null;
        };
        readonly evaluator: {
          readonly kind: EvaluatorKind;
        };
        readonly failureSummary: {
          readonly evaluatedCount: number;
          readonly failedCount: number;
          readonly failureRate: number | null;
          readonly lastError: string | null;
          readonly lastFailedAt: string | null;
        };
        readonly id: string;
        readonly lag: {
          readonly p50Seconds: number;
          readonly p95Seconds: number;
          readonly p99Seconds: number;
        } | null;
        readonly name: string;
        readonly project: {
          readonly id: string;
          readonly name: string;
        };
        readonly runSummary: {
          readonly droppedCount: number;
          readonly evaluatedCount: number;
          readonly failedCount: number;
          readonly lastRunAt: string | null;
          readonly oldestQueuedAt: string | null;
          readonly queuedCount: number;
          readonly runningCount: number;
          readonly status: ProjectEvaluatorRunStatus;
        };
        readonly traceProject: {
          readonly costSummary: {
            readonly completion: {
              readonly cost: number | null;
            };
            readonly prompt: {
              readonly cost: number | null;
            };
            readonly total: {
              readonly cost: number | null;
            };
          };
          readonly id: string;
          readonly traceCount: number;
        };
      };
    }>;
  };
};
export type ServerProjectEvaluatorsTableQuery = {
  response: ServerProjectEvaluatorsTableQuery$data;
  variables: ServerProjectEvaluatorsTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": [
    (v1/*:: as any*/),
    (v2/*:: as any*/)
  ],
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
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
  "name": "enabled",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v5/*:: as any*/),
    (v6/*:: as any*/)
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatedCount",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorRunSummary",
  "kind": "LinkedField",
  "name": "runSummary",
  "plural": false,
  "selections": [
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastRunAt",
      "storageKey": null
    },
    (v2/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "runningCount",
      "storageKey": null
    },
    (v10/*:: as any*/),
    (v11/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "droppedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestQueuedAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorEvaluationLoad",
  "kind": "LinkedField",
  "name": "evaluationLoad",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "meanEvaluationSeconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "shareOfEvaluationTime",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = [
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v15 = {
  "alias": null,
  "args": (v14/*:: as any*/),
  "concreteType": "ProjectEvaluatorFailureSummary",
  "kind": "LinkedField",
  "name": "failureSummary",
  "plural": false,
  "selections": [
    (v11/*:: as any*/),
    (v10/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "failureRate",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastFailedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastError",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": (v14/*:: as any*/),
  "concreteType": "EvaluationLag",
  "kind": "LinkedField",
  "name": "lag",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p50Seconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p95Seconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p99Seconds",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v17 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "traceProject",
  "plural": false,
  "selections": [
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": (v14/*:: as any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v14/*:: as any*/),
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
          "selections": (v17/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v17/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v17/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerProjectEvaluatorsTableQuery",
    "selections": [
      (v3/*:: as any*/),
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "ProjectEvaluatorConnection",
        "kind": "LinkedField",
        "name": "projectEvaluators",
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
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v9/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/),
                  (v13/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  (v18/*:: as any*/)
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ServerProjectEvaluatorsTableQuery",
    "selections": [
      (v3/*:: as any*/),
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "ProjectEvaluatorConnection",
        "kind": "LinkedField",
        "name": "projectEvaluators",
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
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "__typename",
                        "storageKey": null
                      },
                      (v9/*:: as any*/),
                      (v5/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/),
                  (v13/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  (v18/*:: as any*/)
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
    "cacheID": "888baabc8309105909c41f7d74c0b9f7",
    "id": null,
    "metadata": {},
    "name": "ServerProjectEvaluatorsTableQuery",
    "operationKind": "query",
    "text": "query ServerProjectEvaluatorsTableQuery(\n  $first: Int!\n  $timeRange: TimeRange!\n) {\n  evaluationQueue {\n    status\n    queuedCount\n  }\n  projectEvaluators(first: $first) {\n    edges {\n      node {\n        id\n        name\n        enabled\n        project {\n          id\n          name\n        }\n        evaluator {\n          __typename\n          kind\n          id\n        }\n        runSummary {\n          status\n          lastRunAt\n          queuedCount\n          runningCount\n          evaluatedCount\n          failedCount\n          droppedCount\n          oldestQueuedAt\n        }\n        evaluationLoad {\n          evaluationCount\n          meanEvaluationSeconds\n          shareOfEvaluationTime\n        }\n        failureSummary(timeRange: $timeRange) {\n          failedCount\n          evaluatedCount\n          failureRate\n          lastFailedAt\n          lastError\n        }\n        lag(timeRange: $timeRange) {\n          p50Seconds\n          p95Seconds\n          p99Seconds\n        }\n        traceProject {\n          id\n          traceCount(timeRange: $timeRange)\n          costSummary(timeRange: $timeRange) {\n            total {\n              cost\n            }\n            prompt {\n              cost\n            }\n            completion {\n              cost\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "876ea0f7995168c42a74967953d04962";

export default node;
