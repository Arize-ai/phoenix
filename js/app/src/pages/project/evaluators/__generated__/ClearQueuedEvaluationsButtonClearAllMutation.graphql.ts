/**
 * @generated SignedSource<<9805632d479bd724aecab60a07be26d1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsButtonClearAllMutation$variables = Record<PropertyKey, never>;
export type ClearQueuedEvaluationsButtonClearAllMutation$data = {
  readonly clearAllQueuedEvaluations: {
    readonly clearedCount: number;
  };
};
export type ClearQueuedEvaluationsButtonClearAllMutation = {
  response: ClearQueuedEvaluationsButtonClearAllMutation$data;
  variables: ClearQueuedEvaluationsButtonClearAllMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ClearAllQueuedEvaluationsPayload",
    "kind": "LinkedField",
    "name": "clearAllQueuedEvaluations",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ClearQueuedEvaluationsButtonClearAllMutation",
    "selections": (v0/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsButtonClearAllMutation",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "7a53f6a763e0be3b5f5aaa2672bab3e9",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonClearAllMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsButtonClearAllMutation {\n  clearAllQueuedEvaluations {\n    clearedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "dfe0d8f200818ad9e935f89adb4314c3";

export default node;
