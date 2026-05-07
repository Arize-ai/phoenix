/**
 * @generated SignedSource<<d3236c17ff3576bf5d6e482eb79a1039>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type projectLoaderByNameQuery$variables = {
  name: string;
};
export type projectLoaderByNameQuery$data = {
  readonly getProjectByName: {
    readonly id: string;
    readonly name: string;
  } | null;
};
export type projectLoaderByNameQuery = {
  response: projectLoaderByNameQuery$data;
  variables: projectLoaderByNameQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "name"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "concreteType": "Project",
    "kind": "LinkedField",
    "name": "getProjectByName",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectLoaderByNameQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "projectLoaderByNameQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "162d12574e7276cfbd99ef2bdeb935e4",
    "id": null,
    "metadata": {},
    "name": "projectLoaderByNameQuery",
    "operationKind": "query",
    "text": "query projectLoaderByNameQuery(\n  $name: String!\n) {\n  getProjectByName(name: $name) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "9d1959b255769363df9a95c58aa98670";

export default node;
