/**
 * @generated SignedSource<<9582415b048146ba8c0088130af2b1e8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type homeLoaderQuery$variables = Record<PropertyKey, never>;
export type homeLoaderQuery$data = {
  readonly functionality: {
    readonly modelInferences: boolean;
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
    "cacheID": "8bfba02258509f0b645b86f3322838d8",
    "id": null,
    "metadata": {},
    "name": "homeLoaderQuery",
    "operationKind": "query",
    "text": "query homeLoaderQuery {\n  functionality {\n    modelInferences\n  }\n}\n"
  }
};
})();

(node as any).hash = "a248736e236c8d5348e0ecfbe9440ca2";

export default node;
