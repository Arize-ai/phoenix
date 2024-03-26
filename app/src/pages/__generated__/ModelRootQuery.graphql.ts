/**
 * @generated SignedSource<<df662386f58467849411bb66b59ea668>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ModelRootQuery$variables = Record<PropertyKey, never>;
export type ModelRootQuery$data = {
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
export type ModelRootQuery = {
  response: ModelRootQuery$data;
  variables: ModelRootQuery$variables;
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
    "name": "ModelRootQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ModelRootQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8b79fd7c38d3485b9945813c6fd68baa",
    "id": null,
    "metadata": {},
    "name": "ModelRootQuery",
    "operationKind": "query",
    "text": "query ModelRootQuery {\n  model {\n    primaryDataset {\n      name\n      startTime\n      endTime\n    }\n    referenceDataset {\n      name\n      startTime\n      endTime\n    }\n    corpusDataset {\n      name\n      startTime\n      endTime\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3f5bceab9f77e4f079fb0083b04d39ed";

export default node;
