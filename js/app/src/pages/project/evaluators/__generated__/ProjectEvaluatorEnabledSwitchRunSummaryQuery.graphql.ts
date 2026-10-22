/**
 * @generated SignedSource<<c3e872cc7169691b320daed9f5d394b9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "OVERLOADED" | "QUEUED" | "RUNNING";
export type ProjectEvaluatorEnabledSwitchRunSummaryQuery$variables = {
  id: string;
};
export type ProjectEvaluatorEnabledSwitchRunSummaryQuery$data = {
  readonly node: {
    readonly id?: string;
    readonly runSummary?: {
      readonly droppedCount: number;
      readonly oldestQueuedAt: string | null;
      readonly overflowedCount: number;
      readonly queuedCount: number;
      readonly runningCount: number;
      readonly status: ProjectEvaluatorRunStatus;
    };
  };
};
export type ProjectEvaluatorEnabledSwitchRunSummaryQuery = {
  response: ProjectEvaluatorEnabledSwitchRunSummaryQuery$data;
  variables: ProjectEvaluatorEnabledSwitchRunSummaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
      "name": "queuedCount",
      "storageKey": null
    },
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
      "name": "droppedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "overflowedCount",
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorEnabledSwitchRunSummaryQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/)
            ],
            "type": "ProjectEvaluator",
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
    "name": "ProjectEvaluatorEnabledSwitchRunSummaryQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/)
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "625e0e6d8a0db4817473f60af24bdce4",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchRunSummaryQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorEnabledSwitchRunSummaryQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      runSummary {\n        status\n        queuedCount\n        runningCount\n        droppedCount\n        overflowedCount\n        oldestQueuedAt\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "9ccf2a2dc204590f16e552783c7fd78e";

export default node;
