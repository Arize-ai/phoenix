/**
 * @generated SignedSource<<daad469549f9c69434684cf7a4c4070b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "QUEUED" | "RUNNING";
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
    "cacheID": "1b3a911c3a403e9918f53d15d7e702d4",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorEnabledSwitchMutation(\n  $input: SetProjectEvaluatorEnabledInput!\n) {\n  setProjectEvaluatorEnabled(input: $input) {\n    evaluator {\n      id\n      enabled\n      runSummary {\n        status\n        queuedCount\n        droppedCount\n        oldestQueuedAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "90ec866f78a8d9447a9b3c59796b1f9a";

export default node;
