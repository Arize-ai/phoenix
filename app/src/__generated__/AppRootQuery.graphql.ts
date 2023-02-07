/**
 * @generated SignedSource<<53df753454de5335d81e4e3a5b0b44ed>>
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
    readonly primaryDataset: {
      readonly endTime: String;
      readonly name: string;
      readonly startTime: String;
    };
    readonly referenceDataset: {
      readonly endTime: String;
      readonly name: string;
      readonly startTime: String;
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
    "cacheID": "a3f5a96fccf9435cfc5979e306389f78",
    "id": null,
    "metadata": {},
    "name": "AppRootQuery",
    "operationKind": "query",
    "text": "query AppRootQuery {\n  model {\n    primaryDataset {\n      name\n      startTime\n      endTime\n    }\n    referenceDataset {\n      name\n      startTime\n      endTime\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d9826e558e9f04c1e5a8975085bbd64e";

export default node;
