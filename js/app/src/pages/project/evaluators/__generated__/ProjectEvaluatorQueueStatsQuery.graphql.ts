/**
 * @generated SignedSource<<c4a2aef87e8bdd429a3c0db6d0187863>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type ProjectEvaluatorQueueStatsQuery$variables = {
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
    readonly status: EvaluationQueueStatus;
  };
  readonly project: {
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
  "name": "oldestWaitingAt",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "addedPerMinute",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedPerMinute",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": [
    (v1/*:: as any*/),
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v5/*:: as any*/),
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
            (v6/*:: as any*/),
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
    }
  ],
  "storageKey": null
},
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runningCount",
  "storageKey": null
},
v10 = {
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
        (v9/*:: as any*/),
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluationQueueTarget",
          "kind": "LinkedField",
          "name": "targets",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "evaluationTarget",
              "storageKey": null
            },
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
                (v6/*:: as any*/),
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
                    (v9/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v7/*:: as any*/),
      {
        "alias": "project",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*:: as any*/)
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
      (v7/*:: as any*/),
      {
        "alias": "project",
        "args": (v8/*:: as any*/),
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
          (v10/*:: as any*/),
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "33bd13a4ae3d821c106209ac6c891dab",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorQueueStatsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorQueueStatsQuery(\n  $projectId: ID!\n) {\n  evaluationQueue {\n    status\n    queuedCount\n    oldestWaitingAt\n    addedPerMinute\n    completedPerMinute\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationQueue {\n        queuedCount\n        runningCount\n        oldestWaitingAt\n        addedPerMinute\n        completedPerMinute\n        targets {\n          evaluationTarget\n          queuedCount\n        }\n      }\n      evaluators(first: 100) {\n        edges {\n          node {\n            id\n            runSummary {\n              status\n              lastRunAt\n              queuedCount\n              runningCount\n              oldestWaitingOrRetryingAt\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "fd457b714d8b48231a84f0b969901f90";

export default node;
