/**
 * @generated SignedSource<<018a9b28dcafc64b809e01cf18ae9489>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type ClearProjectEvaluatorQueuedEvaluationsInput = {
  projectEvaluatorId: string;
};
export type ProjectEvaluatorEnabledSwitchClearMutation$variables = {
  input: ClearProjectEvaluatorQueuedEvaluationsInput;
};
export type ProjectEvaluatorEnabledSwitchClearMutation$data = {
  readonly clearProjectEvaluatorQueuedEvaluations: {
    readonly evaluator: {
      readonly id: string;
      readonly runSummary: {
        readonly clearedCount: number;
        readonly oldestWaitingOrRetryingAt: string | null;
        readonly queuedCount: number;
        readonly runningCount: number;
        readonly status: ProjectEvaluatorRunStatus;
      };
    };
  };
};
export type ProjectEvaluatorEnabledSwitchClearMutation = {
  response: ProjectEvaluatorEnabledSwitchClearMutation$data;
  variables: ProjectEvaluatorEnabledSwitchClearMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ClearProjectEvaluatorQueuedEvaluationsPayload",
    "kind": "LinkedField",
    "name": "clearProjectEvaluatorQueuedEvaluations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectEvaluator",
        "kind": "LinkedField",
        "name": "evaluator",
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
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorEnabledSwitchClearMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorEnabledSwitchClearMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "13b59f0a33eb32e4d24873185b5d87bc",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchClearMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorEnabledSwitchClearMutation(\n  $input: ClearProjectEvaluatorQueuedEvaluationsInput!\n) {\n  clearProjectEvaluatorQueuedEvaluations(input: $input) {\n    evaluator {\n      id\n      runSummary {\n        status\n        queuedCount\n        runningCount\n        clearedCount\n        oldestWaitingOrRetryingAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1600c231b5f02c3619a1cb548f0f7ac2";

export default node;
