/**
 * @generated SignedSource<<0c0116e9a6ff07b8777ffb837a60d75a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type homeLoaderQuery$variables = {};
export type homeLoaderQuery$data = {
  readonly functionality: {
    readonly modelInferences: boolean;
    readonly tracing: boolean;
  };
};
export type homeLoaderQuery = {
  response: homeLoaderQuery$data;
  variables: homeLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Functionality",
    "kind": "LinkedField",
    "name": "functionality",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "modelInferences",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "tracing",
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
    "name": "homeLoaderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "homeLoaderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "d3fc3d6b214f7c10a10692e6b0bd954b",
    "id": null,
    "metadata": {},
    "name": "homeLoaderQuery",
    "operationKind": "query",
    "text": "query homeLoaderQuery {\n  functionality {\n    modelInferences\n    tracing\n  }\n}\n"
  }
};
})();

(node as any).hash = "b809abc9d06bd4048d3c78598193ec84";

export default node;
