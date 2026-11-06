/**
 * @generated SignedSource<<b3dbab643ae55d95714461bf216411bd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearProjectQueuedEvaluationsInput = {
  projectId: string;
};
export type ClearQueuedEvaluationsButtonMutation$variables = {
  input: ClearProjectQueuedEvaluationsInput;
};
export type ClearQueuedEvaluationsButtonMutation$data = {
  readonly clearProjectQueuedEvaluations: {
    readonly clearedCount: number;
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
    "cacheID": "b9c33f05edf19fd5f4939985119fa102",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsButtonMutation(\n  $input: ClearProjectQueuedEvaluationsInput!\n) {\n  clearProjectQueuedEvaluations(input: $input) {\n    clearedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "dfb3476ee21d9fbd3cffac47710b119a";

export default node;
