/**
 * @generated SignedSource<<a3175a465b0aebfd1dbb194c29f181bf>>
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
    readonly exportedFiles: ReadonlyArray<{
      readonly directory: string;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "directory",
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
    "cacheID": "de284b736ea3e2b329144ba1f4749143",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonExportsQuery",
    "operationKind": "query",
    "text": "query ExportSelectionButtonExportsQuery {\n  model {\n    exportedFiles {\n      fileName\n      directory\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "036999220197c96b84fcdfabd7fb4d27";

export default node;
