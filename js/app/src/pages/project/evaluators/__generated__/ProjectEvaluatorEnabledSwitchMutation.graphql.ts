/**
 * @generated SignedSource<<9b929897815391fe356f99cda3ec1e2a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type SetProjectEvaluatorEnabledInput = {
  enabled: boolean;
  projectEvaluatorId: string;
};
export type ProjectEvaluatorEnabledSwitchMutation$variables = {
  input: SetProjectEvaluatorEnabledInput;
};
export type ProjectEvaluatorEnabledSwitchMutation$data = {
  readonly setProjectEvaluatorEnabled: {
    readonly evaluator: {
      readonly enabled: boolean;
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
export type ProjectEvaluatorEnabledSwitchMutation = {
  response: ProjectEvaluatorEnabledSwitchMutation$data;
  variables: ProjectEvaluatorEnabledSwitchMutation$variables;
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
    "concreteType": "ProjectEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "setProjectEvaluatorEnabled",
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
            "kind": "ScalarField",
            "name": "enabled",
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
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "5aff32432fd054e5a2e1af57f45bdf61",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorEnabledSwitchMutation(\n  $input: SetProjectEvaluatorEnabledInput!\n) {\n  setProjectEvaluatorEnabled(input: $input) {\n    evaluator {\n      id\n      enabled\n      runSummary {\n        status\n        queuedCount\n        runningCount\n        clearedCount\n        oldestWaitingOrRetryingAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "df8cc1b9d891644505ee5a4819603244";

export default node;
