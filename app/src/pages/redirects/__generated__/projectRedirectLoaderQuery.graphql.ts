/**
 * @generated SignedSource<<eccd8e150686782688d13e8f33586a18>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type projectRedirectLoaderQuery$variables = {
  name: string;
};
export type projectRedirectLoaderQuery$data = {
  readonly getProjectByName: {
    readonly id: string;
  } | null;
};
export type projectRedirectLoaderQuery = {
  response: projectRedirectLoaderQuery$data;
  variables: projectRedirectLoaderQuery$variables;
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
    "name": "projectRedirectLoaderQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "projectRedirectLoaderQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6c3f29d38011fdeac1deaf9def004c3b",
    "id": null,
    "metadata": {},
    "name": "projectRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query projectRedirectLoaderQuery(\n  $name: String!\n) {\n  getProjectByName(name: $name) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "55396036e167c1a7b6ec3765e5faeec9";

export default node;
