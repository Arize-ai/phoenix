/**
 * @generated SignedSource<<2c6d334fcdd43b45d1ac180d6c1c9c97>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ExportSelectionButtonExportsQuery$variables = {};
export type ExportSelectionButtonExportsQuery$data = {
  readonly model: {
    readonly exportedFiles: ReadonlyArray<string>;
  };
};
export type ExportSelectionButtonExportsQuery = {
  response: ExportSelectionButtonExportsQuery$data;
  variables: ExportSelectionButtonExportsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Model",
    "kind": "LinkedField",
    "name": "model",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "exportedFiles",
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
    "name": "ExportSelectionButtonExportsQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ExportSelectionButtonExportsQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "8696c09fa08220c2e558496b3294370c",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonExportsQuery",
    "operationKind": "query",
    "text": "query ExportSelectionButtonExportsQuery {\n  model {\n    exportedFiles\n  }\n}\n"
  }
};
})();

(node as any).hash = "bc2ec3ce8dff0dd0d729b247de4a84f8";

export default node;
