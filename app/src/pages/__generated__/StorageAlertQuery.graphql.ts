/**
 * @generated SignedSource<<6fc461302ecf5870606b8e9a30e3dd9c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type StorageAlertQuery$variables = Record<PropertyKey, never>;
export type StorageAlertQuery$data = {
  readonly serverStatus: {
    readonly insufficientStorage: boolean;
  };
};
export type StorageAlertQuery = {
  response: StorageAlertQuery$data;
  variables: StorageAlertQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ServerStatus",
    "kind": "LinkedField",
    "name": "serverStatus",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "insufficientStorage",
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
    "name": "StorageAlertQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "StorageAlertQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "f9f3d6dcbdc1417ed8012eebb951f0e2",
    "id": null,
    "metadata": {},
    "name": "StorageAlertQuery",
    "operationKind": "query",
    "text": "query StorageAlertQuery {\n  serverStatus {\n    insufficientStorage\n  }\n}\n"
  }
};
})();

(node as any).hash = "5c04da349a0a5767c71ce3cb72ee8d17";

export default node;
