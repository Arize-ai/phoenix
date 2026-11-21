/**
 * @generated SignedSource<<fee2fcd91c4d0effa1e5205942737520>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorsTabTableQuery$variables = {
  first: number;
  timeRange: TimeRange;
};
export type ProjectEvaluatorsTabTableQuery$data = {
  readonly evaluationQueue: {
    readonly queuedCount: number;
  };
  readonly projectEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
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
        } | null;
        readonly enabled: boolean;
        readonly evaluationLoad: {
          readonly evaluationCount: number;
          readonly excludesUntracedEvaluators: boolean;
          readonly meanEvaluationSeconds: number | null;
          readonly shareOfEvaluationTime: number | null;
        };
        readonly evaluationTarget: EvaluationTarget;
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
          readonly clearedCount: number;
          readonly evaluatedCount: number;
          readonly failedCount: number;
          readonly lastRunAt: string | null;
          readonly oldestWaitingOrRetryingAt: string | null;
          readonly queuedCount: number;
          readonly runningCount: number;
          readonly status: ProjectEvaluatorRunStatus;
        };
        readonly tracedEvaluationCount: number | null;
        readonly tracingEnabled: boolean;
      };
    }>;
  };
};
export type ProjectEvaluatorsTabTableQuery = {
  response: ProjectEvaluatorsTabTableQuery$data;
  variables: ProjectEvaluatorsTabTableQuery$variables;
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
  "name": "queuedCount",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": [
    (v1/*:: as any*/)
  ],
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
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
    (v4/*:: as any*/),
    (v5/*:: as any*/)
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
    (v1/*:: as any*/),
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
      "name": "clearedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestWaitingOrRetryingAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tracingEnabled",
  "storageKey": null
},
v14 = {
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "excludesUntracedEvaluators",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v15 = [
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v16 = {
  "alias": null,
  "args": (v15/*:: as any*/),
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
v17 = {
  "alias": null,
  "args": (v15/*:: as any*/),
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
v18 = {
  "alias": null,
  "args": (v15/*:: as any*/),
  "kind": "ScalarField",
  "name": "tracedEvaluationCount",
  "storageKey": null
},
v19 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v20 = {
  "alias": null,
  "args": (v15/*:: as any*/),
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
      "selections": (v19/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v19/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v19/*:: as any*/),
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
    "name": "ProjectEvaluatorsTabTableQuery",
    "selections": [
      (v2/*:: as any*/),
      {
        "alias": null,
        "args": (v3/*:: as any*/),
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
                  (v4/*:: as any*/),
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
                  (v14/*:: as any*/),
                  (v16/*:: as any*/),
                  (v17/*:: as any*/),
                  (v18/*:: as any*/),
                  (v20/*:: as any*/)
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
    "name": "ProjectEvaluatorsTabTableQuery",
    "selections": [
      (v2/*:: as any*/),
      {
        "alias": null,
        "args": (v3/*:: as any*/),
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
                  (v4/*:: as any*/),
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
                      (v4/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/),
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  (v16/*:: as any*/),
                  (v17/*:: as any*/),
                  (v18/*:: as any*/),
                  (v20/*:: as any*/)
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
    "cacheID": "cff0c8797d745e8de4447356f9648f4d",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorsTabTableQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorsTabTableQuery(\n  $first: Int!\n  $timeRange: TimeRange!\n) {\n  evaluationQueue {\n    queuedCount\n  }\n  projectEvaluators(first: $first) {\n    edges {\n      node {\n        id\n        name\n        enabled\n        evaluationTarget\n        project {\n          id\n          name\n        }\n        evaluator {\n          __typename\n          kind\n          id\n        }\n        runSummary {\n          status\n          lastRunAt\n          queuedCount\n          runningCount\n          evaluatedCount\n          failedCount\n          clearedCount\n          oldestWaitingOrRetryingAt\n        }\n        tracingEnabled\n        evaluationLoad {\n          evaluationCount\n          meanEvaluationSeconds\n          shareOfEvaluationTime\n          excludesUntracedEvaluators\n        }\n        failureSummary(timeRange: $timeRange) {\n          failedCount\n          evaluatedCount\n          failureRate\n          lastFailedAt\n          lastError\n        }\n        lag(timeRange: $timeRange) {\n          p50Seconds\n          p95Seconds\n          p99Seconds\n        }\n        tracedEvaluationCount(timeRange: $timeRange)\n        costSummary(timeRange: $timeRange) {\n          total {\n            cost\n          }\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "037731971c6c4b1af45c5a97eed2392b";

export default node;
