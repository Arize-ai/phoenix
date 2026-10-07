/**
 * @generated SignedSource<<d81a327e00c3dc5ae8589eae1e5c8633>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsButtonClearAllMutation$variables = Record<PropertyKey, never>;
export type ClearQueuedEvaluationsButtonClearAllMutation$data = {
  readonly clearAllQueuedEvaluations: {
    readonly droppedCount: number;
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
        "name": "droppedCount",
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
    "cacheID": "cf8fa4bacf7cf61fc20a3a6d98b8b1a4",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonClearAllMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsButtonClearAllMutation {\n  clearAllQueuedEvaluations {\n    droppedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "f45f4fec90c7b3a11ea2ac82cb0e7129";

export default node;
