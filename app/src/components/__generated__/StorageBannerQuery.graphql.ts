/**
 * @generated SignedSource<<56f30cd0a3da1695303e86c75f5fe26b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type StorageBannerQuery$variables = Record<PropertyKey, never>;
export type StorageBannerQuery$data = {
  readonly serverStatus: {
    readonly insufficientStorage: boolean;
    readonly supportEmail: string | null;
  };
};
export type StorageBannerQuery = {
  response: StorageBannerQuery$data;
  variables: StorageBannerQuery$variables;
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
    "name": "StorageBannerQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "StorageBannerQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9faa3b71445c917369cce6de67c42444",
    "id": null,
    "metadata": {},
    "name": "StorageBannerQuery",
    "operationKind": "query",
    "text": "query StorageBannerQuery {\n  serverStatus {\n    insufficientStorage\n    supportEmail\n  }\n}\n"
  }
};
})();

(node as any).hash = "214e6599db2f56cc0fd7c246d43e7013";

export default node;
