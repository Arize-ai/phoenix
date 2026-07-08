/**
 * @generated SignedSource<<132ad8442f39674b897ecd5a9d0ab8c8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type layoutLoaderQuery$variables = Record<PropertyKey, never>;
export type layoutLoaderQuery$data = {
  readonly datasetCount: number;
  readonly evaluatorCount: number;
  readonly projectCount: number;
  readonly promptCount: number;
};
export type layoutLoaderQuery = {
  response: layoutLoaderQuery$data;
  variables: layoutLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "projectCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "datasetCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "promptCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "evaluatorCount",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "layoutLoaderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "layoutLoaderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "bd9d561e7b62e792627d75e8eaef3b0d",
    "id": null,
    "metadata": {},
    "name": "layoutLoaderQuery",
    "operationKind": "query",
    "text": "query layoutLoaderQuery {\n  projectCount\n  datasetCount\n  promptCount\n  evaluatorCount\n}\n"
  }
};
})();

(node as any).hash = "e2893154dd0f4ebe5ece4c2ca10e2055";

export default node;
