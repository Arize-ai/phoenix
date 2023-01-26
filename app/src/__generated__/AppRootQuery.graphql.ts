/**
 * @generated SignedSource<<265bf9796d295f06d4d16444d3d3b686>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type AppRootQuery$variables = {};
export type AppRootQuery$data = {
  readonly primaryDataset: {
    readonly endTime: string;
    readonly name: string;
    readonly startTime: string;
  };
  readonly referenceDataset: {
    readonly endTime: string;
    readonly name: string;
    readonly startTime: string;
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
    "cacheID": "d4307243a1ca8536ced464cf7c3359ce",
    "id": null,
    "metadata": {},
    "name": "AppRootQuery",
    "operationKind": "query",
    "text": "query AppRootQuery {\n  primaryDataset {\n    name\n    startTime\n    endTime\n  }\n  referenceDataset {\n    name\n    startTime\n    endTime\n  }\n}\n"
  }
};
})();

(node as any).hash = "2f1366a7b6eae055b970061fb3e965b7";

export default node;
