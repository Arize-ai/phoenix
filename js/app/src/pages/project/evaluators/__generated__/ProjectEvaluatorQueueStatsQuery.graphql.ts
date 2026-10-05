/**
 * @generated SignedSource<<00b56ad7b63715fd634d55ed4474c09d>>
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
  readonly evaluationQueue: {
    readonly atCapacity: boolean;
    readonly evaluationsPerMinute: number;
    readonly oldestQueuedAt: string | null;
    readonly queuedCount: number;
    readonly queuedLimit: number;
    readonly queuedPerMinute: number;
    readonly retryingCount: number;
    readonly status: EvaluationQueueStatus;
    readonly targets: ReadonlyArray<{
      readonly evaluationTarget: EvaluationTarget;
      readonly evaluationsPerMinute: number;
      readonly oldestQueuedAt: string | null;
      readonly queuedCount: number;
      readonly queuedPerMinute: number;
      readonly retryingCount: number;
    }>;
  };
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
  "kind": "ScalarField",
  "name": "retryingCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "oldestQueuedAt",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedPerMinute",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationsPerMinute",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
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
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluationQueueTarget",
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
        (v1/*:: as any*/),
        (v2/*:: as any*/),
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v8 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v9 = {
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
v10 = {
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
      (v6/*:: as any*/),
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
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
                "args": (v8/*:: as any*/),
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
                          (v9/*:: as any*/)
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
      (v6/*:: as any*/),
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
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
                "args": (v8/*:: as any*/),
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
                          (v9/*:: as any*/),
                          (v10/*:: as any*/)
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
          (v10/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ab182852b9ec5c2da1d03bf9c4573995",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorQueueStatsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorQueueStatsQuery(\n  $projectId: ID!\n) {\n  evaluationQueue {\n    status\n    atCapacity\n    queuedCount\n    queuedLimit\n    retryingCount\n    oldestQueuedAt\n    queuedPerMinute\n    evaluationsPerMinute\n    targets {\n      evaluationTarget\n      queuedCount\n      retryingCount\n      oldestQueuedAt\n      queuedPerMinute\n      evaluationsPerMinute\n    }\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: 100) {\n        edges {\n          node {\n            runSummary {\n              queuedCount\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "8c30decfcea006c439b7c9e12ad2abe4";

export default node;
