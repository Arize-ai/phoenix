/**
 * @generated SignedSource<<c8aee54875e5a51470be69849c9aabdd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearProjectQueuedEvaluationsInput = {
  projectId: string;
};
export type ClearQueuedEvaluationsMenuMutation$variables = {
  input: ClearProjectQueuedEvaluationsInput;
};
export type ClearQueuedEvaluationsMenuMutation$data = {
  readonly clearProjectQueuedEvaluations: {
    readonly clearedCount: number;
  };
};
export type ClearQueuedEvaluationsMenuMutation = {
  response: ClearQueuedEvaluationsMenuMutation$data;
  variables: ClearQueuedEvaluationsMenuMutation$variables;
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
    "concreteType": "ClearProjectQueuedEvaluationsPayload",
    "kind": "LinkedField",
    "name": "clearProjectQueuedEvaluations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "clearedCount",
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
    "name": "ClearQueuedEvaluationsMenuMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsMenuMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "7d054331bd2bf37d9eee3878beef6992",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsMenuMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsMenuMutation(\n  $input: ClearProjectQueuedEvaluationsInput!\n) {\n  clearProjectQueuedEvaluations(input: $input) {\n    clearedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "09d9068ecb7327e568ae34b4b6b3c260";

export default node;
