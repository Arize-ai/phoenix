/**
 * @generated SignedSource<<64b09705ecb8ddcf058b9c9a4077ec40>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorQueueStatsQuery$variables = {
  projectId: string;
};
export type ProjectEvaluatorQueueStatsQuery$data = {
  readonly evaluationQueues: ReadonlyArray<{
    readonly atCapacity: boolean;
    readonly evaluationTarget: EvaluationTarget;
    readonly evaluationsPerMinute: number;
    readonly oldestQueuedAt: string | null;
    readonly queuedCount: number;
    readonly queuedLimit: number;
    readonly queuedPerMinute: number;
    readonly retryingCount: number;
    readonly status: EvaluationQueueStatus;
  }>;
  readonly project: {
    readonly evaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly runSummary: {
            readonly queuedCount: number;
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
  "name": "queuedCount",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueues",
  "plural": true,
  "selections": [
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
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "atCapacity",
      "storageKey": null
    },
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "queuedLimit",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "retryingCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestQueuedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "queuedPerMinute",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationsPerMinute",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorRunSummary",
  "kind": "LinkedField",
  "name": "runSummary",
  "plural": false,
  "selections": [
    (v1/*:: as any*/)
  ],
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v2/*:: as any*/),
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
              {
                "alias": null,
                "args": (v4/*:: as any*/),
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
                          (v5/*:: as any*/)
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
    "name": "ProjectEvaluatorQueueStatsQuery",
    "selections": [
      (v2/*:: as any*/),
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
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
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
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
                          (v5/*:: as any*/),
                          (v6/*:: as any*/)
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
          },
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3173262c8e346d177a1d4976548f9298",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorQueueStatsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorQueueStatsQuery(\n  $projectId: ID!\n) {\n  evaluationQueues {\n    evaluationTarget\n    status\n    atCapacity\n    queuedCount\n    queuedLimit\n    retryingCount\n    oldestQueuedAt\n    queuedPerMinute\n    evaluationsPerMinute\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: 100) {\n        edges {\n          node {\n            runSummary {\n              queuedCount\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "de1bc4795984925ef8def77df794293e";

export default node;
