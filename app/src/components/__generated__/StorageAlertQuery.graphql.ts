/**
 * @generated SignedSource<<e8e8b9bef15752f539a67ddafa183d0a>>
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
    readonly supportEmail: string | null;
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
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "supportEmail",
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
    "cacheID": "806ff4e9dcf7058985985fd54664bf1e",
    "id": null,
    "metadata": {},
    "name": "StorageAlertQuery",
    "operationKind": "query",
    "text": "query StorageAlertQuery {\n  serverStatus {\n    insufficientStorage\n    supportEmail\n  }\n}\n"
  }
};
})();

(node as any).hash = "d8f1960de267cd66dabe56d1971cec38";

export default node;
