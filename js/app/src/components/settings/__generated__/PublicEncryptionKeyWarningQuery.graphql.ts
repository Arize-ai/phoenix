/**
 * @generated SignedSource<<ffe9ce491bb952841858ee2ab5bdf472>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PublicEncryptionKeyWarningQuery$variables = Record<PropertyKey, never>;
export type PublicEncryptionKeyWarningQuery$data = {
  readonly serverStatus: {
    readonly databaseEncryptionKeyIsPublic: boolean | null;
  };
};
export type PublicEncryptionKeyWarningQuery = {
  response: PublicEncryptionKeyWarningQuery$data;
  variables: PublicEncryptionKeyWarningQuery$variables;
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
        "name": "databaseEncryptionKeyIsPublic",
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
    "name": "PublicEncryptionKeyWarningQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PublicEncryptionKeyWarningQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "ba39fffe9f124286a7594127cc841827",
    "id": null,
    "metadata": {},
    "name": "PublicEncryptionKeyWarningQuery",
    "operationKind": "query",
    "text": "query PublicEncryptionKeyWarningQuery {\n  serverStatus {\n    databaseEncryptionKeyIsPublic\n  }\n}\n"
  }
};
})();

(node as any).hash = "4a10b8af21f991679f484d6cbffe5b9c";

export default node;
