/**
 * @generated SignedSource<<b9dfc6bc644ad3f0d55a2a21fa980ae2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eda7eb3c87442902fbec6b033ad5f131",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorEnabledSwitchMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorEnabledSwitchMutation(\n  $input: SetProjectEvaluatorEnabledInput!\n) {\n  setProjectEvaluatorEnabled(input: $input) {\n    evaluator {\n      id\n      enabled\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "73ce82e589024920957e8533f692f30a";

export default node;
