/**
 * @generated SignedSource<<35ee54f8bd189c2ca5a6bac3db9a422f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type exampleRedirectLoaderQuery$variables = {
  datasetId: string;
  externalId: string;
};
export type exampleRedirectLoaderQuery$data = {
  readonly example: {
    readonly id: string;
  } | null;
};
export type exampleRedirectLoaderQuery = {
  response: exampleRedirectLoaderQuery$data;
  variables: exampleRedirectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "externalId"
  }
],
v1 = [
  {
    "alias": "example",
    "args": [
      {
        "kind": "Variable",
        "name": "datasetId",
        "variableName": "datasetId"
      },
      {
        "kind": "Variable",
        "name": "externalId",
        "variableName": "externalId"
      }
    ],
    "concreteType": "DatasetExample",
    "kind": "LinkedField",
    "name": "getDatasetExampleByExternalId",
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
    "name": "exampleRedirectLoaderQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "exampleRedirectLoaderQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "46e770672fe1363db9a2d3f4562f6746",
    "id": null,
    "metadata": {},
    "name": "exampleRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query exampleRedirectLoaderQuery(\n  $datasetId: ID!\n  $externalId: String!\n) {\n  example: getDatasetExampleByExternalId(datasetId: $datasetId, externalId: $externalId) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "906e1801a36666b920dfc107d70d11c4";

export default node;
