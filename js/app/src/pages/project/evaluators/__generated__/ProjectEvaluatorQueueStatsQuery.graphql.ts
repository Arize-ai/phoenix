/**
 * @generated SignedSource<<a591ea6e7739609af81b73039b758ccb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY" | "OVERLOADED";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "OVERLOADED" | "QUEUED" | "RUNNING";
export type ProjectEvaluatorQueueStatsQuery$variables = {
  projectId: string;
};
export type ProjectEvaluatorQueueStatsQuery$data = {
  readonly evaluationQueue: {
    readonly atCapacity: boolean;
    readonly evaluationsPerMinute: number;
    readonly oldestQueuedAt: string | null;
    readonly projects: ReadonlyArray<{
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
      readonly queuedCount: number;
    }>;
    readonly queuedCount: number;
    readonly queuedLimit: number;
    readonly queuedPerMinute: number;
    readonly retryingCount: number;
    readonly runningCount: number;
    readonly status: EvaluationQueueStatus;
    readonly targets: ReadonlyArray<{
      readonly evaluationTarget: EvaluationTarget;
      readonly evaluationsPerMinute: number;
      readonly oldestQueuedAt: string | null;
      readonly overflowedCount: number;
      readonly queuedCount: number;
      readonly queuedPerMinute: number;
      readonly retryingCount: number;
    }>;
  };
  readonly project: {
    readonly evaluationQueue?: {
      readonly evaluationsPerMinute: number;
      readonly oldestQueuedAt: string | null;
      readonly queuedCount: number;
      readonly queuedPerMinute: number;
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
            readonly oldestQueuedAt: string | null;
            readonly overflowedCount: number;
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
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
  "kind": "ScalarField",
  "name": "retryingCount",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "oldestQueuedAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedPerMinute",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationsPerMinute",
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
  "kind": "ScalarField",
  "name": "overflowedCount",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": [
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "atCapacity",
      "storageKey": null
    },
    (v2/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "queuedLimit",
      "storageKey": null
    },
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
        (v2/*:: as any*/)
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
        (v2/*:: as any*/),
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v10/*:: as any*/),
        (v5/*:: as any*/),
        (v6/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v12 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v13 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectEvaluationQueue",
      "kind": "LinkedField",
      "name": "evaluationQueue",
      "plural": false,
      "selections": [
        (v2/*:: as any*/),
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
            (v2/*:: as any*/)
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
                    (v1/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lastRunAt",
                      "storageKey": null
                    },
                    (v2/*:: as any*/),
                    (v7/*:: as any*/),
                    (v4/*:: as any*/),
                    (v10/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v11/*:: as any*/),
      {
        "alias": "project",
        "args": (v12/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v13/*:: as any*/)
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
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v11/*:: as any*/),
      {
        "alias": "project",
        "args": (v12/*:: as any*/),
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
          (v13/*:: as any*/),
          (v8/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6158a4a578c04b376ce768f137885569",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorQueueStatsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorQueueStatsQuery(\n  $projectId: ID!\n) {\n  evaluationQueue {\n    status\n    atCapacity\n    queuedCount\n    queuedLimit\n    retryingCount\n    oldestQueuedAt\n    queuedPerMinute\n    evaluationsPerMinute\n    runningCount\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n    targets {\n      evaluationTarget\n      queuedCount\n      retryingCount\n      oldestQueuedAt\n      overflowedCount\n      queuedPerMinute\n      evaluationsPerMinute\n    }\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationQueue {\n        queuedCount\n        runningCount\n        oldestQueuedAt\n        queuedPerMinute\n        evaluationsPerMinute\n        targets {\n          evaluationTarget\n          queuedCount\n        }\n      }\n      evaluators(first: 100) {\n        edges {\n          node {\n            id\n            runSummary {\n              status\n              lastRunAt\n              queuedCount\n              runningCount\n              oldestQueuedAt\n              overflowedCount\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "73ae16d1790d8f1088f16525f7415bb3";

export default node;
