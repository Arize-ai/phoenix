/**
 * @generated SignedSource<<4c274bf332e0d9c355ca08058b47928a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsInput = {
  projectId: string;
};
export type ClearQueuedEvaluationsButtonMutation$variables = {
  input: ClearQueuedEvaluationsInput;
};
export type ClearQueuedEvaluationsButtonMutation$data = {
  readonly clearQueuedEvaluations: {
    readonly droppedCount: number;
  };
};
export type ClearQueuedEvaluationsButtonMutation = {
  response: ClearQueuedEvaluationsButtonMutation$data;
  variables: ClearQueuedEvaluationsButtonMutation$variables;
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
    "concreteType": "ClearQueuedEvaluationsPayload",
    "kind": "LinkedField",
    "name": "clearQueuedEvaluations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "droppedCount",
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
    "name": "ClearQueuedEvaluationsButtonMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsButtonMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "11a609adf8c2948b446f89fbfe512514",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsButtonMutation(\n  $input: ClearQueuedEvaluationsInput!\n) {\n  clearQueuedEvaluations(input: $input) {\n    droppedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "505d488fa440f4dcabccf0db41df5b0c";

export default node;
