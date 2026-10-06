/**
 * @generated SignedSource<<d6840a91ca30862245a8c46095832c42>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "OVERLOADED" | "QUEUED" | "RUNNING";
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
        readonly droppedCount: number;
        readonly oldestQueuedAt: string | null;
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
                "name": "droppedCount",
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
    "cacheID": "360dfbd3d3dc6c9acd368b076cbc77ee",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorEnabledSwitchMutation(\n  $input: SetProjectEvaluatorEnabledInput!\n) {\n  setProjectEvaluatorEnabled(input: $input) {\n    evaluator {\n      id\n      enabled\n      runSummary {\n        status\n        queuedCount\n        runningCount\n        droppedCount\n        oldestQueuedAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "283c0a4f6f9ec094ebe117319f31320d";

export default node;
