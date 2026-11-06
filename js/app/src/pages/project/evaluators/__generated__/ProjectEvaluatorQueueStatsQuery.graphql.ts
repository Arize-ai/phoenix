/**
 * @generated SignedSource<<7673cef1b5e909cf2fad97e5439697e4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorQueueStatsQuery$variables = {
  lagTimeRange: TimeRange;
  projectId: string;
};
export type ProjectEvaluatorQueueStatsQuery$data = {
  readonly evaluationQueue: {
    readonly addedPerMinute: number;
    readonly completedPerMinute: number;
    readonly oldestWaitingAt: string | null;
    readonly projects: ReadonlyArray<{
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
      readonly queuedCount: number;
    }>;
    readonly queuedCount: number;
    readonly runningCount: number;
    readonly status: EvaluationQueueStatus;
    readonly targets: ReadonlyArray<{
      readonly addedPerMinute: number;
      readonly completedPerMinute: number;
      readonly evaluationTarget: EvaluationTarget;
      readonly oldestWaitingAt: string | null;
      readonly queuedCount: number;
    }>;
  };
  readonly project: {
    readonly evaluationActivity?: {
      readonly lag: {
        readonly p95Seconds: number;
      } | null;
    };
    readonly evaluationQueue?: {
      readonly addedPerMinute: number;
      readonly completedPerMinute: number;
      readonly oldestWaitingAt: string | null;
      readonly queuedCount: number;
      readonly runningCount: number;
      readonly targets: ReadonlyArray<{
        readonly evaluationTarget: EvaluationTarget;
        readonly queuedCount: number;
      }>;
    };
    readonly evaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly id: string;
          readonly runSummary: {
            readonly lastRunAt: string | null;
            readonly oldestWaitingOrRetryingAt: string | null;
            readonly queuedCount: number;
            readonly runningCount: number;
            readonly status: ProjectEvaluatorRunStatus;
          };
        };
      }>;
    };
  };
};
export type ProjectEvaluatorQueueStatsQuery = {
  response: ProjectEvaluatorQueueStatsQuery$data;
  variables: ProjectEvaluatorQueueStatsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "lagTimeRange"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedCount",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "oldestWaitingAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "addedPerMinute",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedPerMinute",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runningCount",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v5/*:: as any*/),
    (v6/*:: as any*/),
    (v7/*:: as any*/),
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 5
        }
      ],
      "concreteType": "EvaluationQueueProject",
      "kind": "LinkedField",
      "name": "projects",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "Project",
          "kind": "LinkedField",
          "name": "project",
          "plural": false,
          "selections": [
            (v8/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        (v3/*:: as any*/)
      ],
      "storageKey": "projects(first:5)"
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluationQueueTarget",
      "kind": "LinkedField",
      "name": "targets",
      "plural": true,
      "selections": [
        (v9/*:: as any*/),
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/),
        (v6/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v12 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "lagTimeRange"
        }
      ],
      "concreteType": "EvaluationActivity",
      "kind": "LinkedField",
      "name": "evaluationActivity",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "EvaluationLag",
          "kind": "LinkedField",
          "name": "lag",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p95Seconds",
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
      "concreteType": "ProjectEvaluationQueue",
      "kind": "LinkedField",
      "name": "evaluationQueue",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        (v7/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/),
        (v6/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluationQueueTarget",
          "kind": "LinkedField",
          "name": "targets",
          "plural": true,
          "selections": [
            (v9/*:: as any*/),
            (v3/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 100
        }
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
                (v8/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "ProjectEvaluatorRunSummary",
                  "kind": "LinkedField",
                  "name": "runSummary",
                  "plural": false,
                  "selections": [
                    (v2/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lastRunAt",
                      "storageKey": null
                    },
                    (v3/*:: as any*/),
                    (v7/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "oldestWaitingOrRetryingAt",
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
      "storageKey": "evaluators(first:100)"
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v10/*:: as any*/),
      {
        "alias": "project",
        "args": (v11/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v12/*:: as any*/)
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
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v10/*:: as any*/),
      {
        "alias": "project",
        "args": (v11/*:: as any*/),
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
          (v12/*:: as any*/),
          (v8/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "aff224cc7f3c46aeb56676048032f636",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorQueueStatsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorQueueStatsQuery(\n  $projectId: ID!\n  $lagTimeRange: TimeRange!\n) {\n  evaluationQueue {\n    status\n    queuedCount\n    oldestWaitingAt\n    addedPerMinute\n    completedPerMinute\n    runningCount\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n    targets {\n      evaluationTarget\n      queuedCount\n      oldestWaitingAt\n      addedPerMinute\n      completedPerMinute\n    }\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationActivity(timeRange: $lagTimeRange) {\n        lag {\n          p95Seconds\n        }\n      }\n      evaluationQueue {\n        queuedCount\n        runningCount\n        oldestWaitingAt\n        addedPerMinute\n        completedPerMinute\n        targets {\n          evaluationTarget\n          queuedCount\n        }\n      }\n      evaluators(first: 100) {\n        edges {\n          node {\n            id\n            runSummary {\n              status\n              lastRunAt\n              queuedCount\n              runningCount\n              oldestWaitingOrRetryingAt\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e4aa600e96a596d326e28cc87f0d232d";

export default node;
