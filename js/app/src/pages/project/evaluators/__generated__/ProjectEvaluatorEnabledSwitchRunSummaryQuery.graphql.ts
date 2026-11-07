/**
 * @generated SignedSource<<a59f87e3e4e790bda55384fef758157b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type ProjectEvaluatorEnabledSwitchRunSummaryQuery$variables = {
  id: string;
};
export type ProjectEvaluatorEnabledSwitchRunSummaryQuery$data = {
  readonly node: {
    readonly id?: string;
    readonly runSummary?: {
      readonly clearedCount: number;
      readonly oldestWaitingOrRetryingAt: string | null;
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
    "cacheID": "d40b7b8f896f52b9388f83eb9367e13c",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchRunSummaryQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorEnabledSwitchRunSummaryQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      runSummary {\n        status\n        queuedCount\n        runningCount\n        clearedCount\n        oldestWaitingOrRetryingAt\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d24ed0211001153e60a9aa77a7271010";

export default node;
