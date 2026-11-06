/**
 * @generated SignedSource<<c50572ce5e6824748890903045d27a88>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ServerEvaluationQueueStripQuery$variables = Record<PropertyKey, never>;
export type ServerEvaluationQueueStripQuery$data = {
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
      readonly evaluationTarget: EvaluationTarget;
      readonly queuedCount: number;
    }>;
  };
};
export type ServerEvaluationQueueStripQuery = {
  response: ServerEvaluationQueueStripQuery$data;
  variables: ServerEvaluationQueueStripQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedCount",
  "storageKey": null
},
v1 = [
  {
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
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "runningCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "oldestWaitingAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "addedPerMinute",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completedPerMinute",
        "storageKey": null
      },
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
          (v0/*:: as any*/)
        ],
        "storageKey": null
      },
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
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
          (v0/*:: as any*/)
        ],
        "storageKey": "projects(first:5)"
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerEvaluationQueueStripQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ServerEvaluationQueueStripQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d7e4875d1d922e3bbcfaf391716e3769",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationQueueStripQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationQueueStripQuery {\n  evaluationQueue {\n    status\n    queuedCount\n    runningCount\n    oldestWaitingAt\n    addedPerMinute\n    completedPerMinute\n    targets {\n      evaluationTarget\n      queuedCount\n    }\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c736c59a8f685ff0acbc09cf884d2c01";

export default node;
