/**
 * @generated SignedSource<<96705e061fac5d7b5342fa47f4f8c1e3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsMenuClearAllMutation$variables = Record<PropertyKey, never>;
export type ClearQueuedEvaluationsMenuClearAllMutation$data = {
  readonly clearAllQueuedEvaluations: {
    readonly clearedCount: number;
  };
};
export type ClearQueuedEvaluationsMenuClearAllMutation = {
  response: ClearQueuedEvaluationsMenuClearAllMutation$data;
  variables: ClearQueuedEvaluationsMenuClearAllMutation$variables;
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
    "name": "ClearQueuedEvaluationsMenuClearAllMutation",
    "selections": (v0/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsMenuClearAllMutation",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "95fc93db2eb403699f212b6ebfa39673",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsMenuClearAllMutation",
    "operationKind": "mutation",
    "text": "mutation ClearQueuedEvaluationsMenuClearAllMutation {\n  clearAllQueuedEvaluations {\n    clearedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "0be81506262b2d20662160e1ff58b617";

export default node;
