/**
 * @generated SignedSource<<6638f580958646171362e51b4267c701>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type AppRootQuery$variables = {};
export type AppRootQuery$data = {
  readonly model: {
    readonly corpusDataset: {
      readonly endTime: string;
      readonly name: string;
      readonly startTime: string;
    } | null;
    readonly primaryDataset: {
      readonly endTime: string;
      readonly name: string;
      readonly startTime: string;
    };
    readonly referenceDataset: {
      readonly endTime: string;
      readonly name: string;
      readonly startTime: string;
    } | null;
  };
};
export type AppRootQuery = {
  response: AppRootQuery$data;
  variables: AppRootQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "startTime",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "endTime",
    "storageKey": null
  }
],
v1 = [
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
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "primaryDataset",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "referenceDataset",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "corpusDataset",
        "plural": false,
        "selections": (v0/*: any*/),
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
    "name": "AppRootQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AppRootQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f38f98209ceb4222ae918e254d66848e",
    "id": null,
    "metadata": {},
    "name": "AppRootQuery",
    "operationKind": "query",
    "text": "query AppRootQuery {\n  model {\n    primaryDataset {\n      name\n      startTime\n      endTime\n    }\n    referenceDataset {\n      name\n      startTime\n      endTime\n    }\n    corpusDataset {\n      name\n      startTime\n      endTime\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e76b5097b7331cff60606dbee99c6c3";

export default node;
