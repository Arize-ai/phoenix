/**
 * @generated SignedSource<<28eea2320d6b7e29ea9d04c777c2fbc8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ExportSelectionButtonExportsQuery$variables = Record<PropertyKey, never>;
export type ExportSelectionButtonExportsQuery$data = {
  readonly model: {
    readonly exportedFiles: ReadonlyArray<{
      readonly fileName: string;
    }>;
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
        "concreteType": "ExportedFile",
        "kind": "LinkedField",
        "name": "exportedFiles",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "fileName",
            "storageKey": null
          }
        ],
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
    "cacheID": "2f7e3554305121746dc799b6a8d120da",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonExportsQuery",
    "operationKind": "query",
    "text": "query ExportSelectionButtonExportsQuery {\n  model {\n    exportedFiles {\n      fileName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7e6db431afe21f137e54505645c787f4";

export default node;
