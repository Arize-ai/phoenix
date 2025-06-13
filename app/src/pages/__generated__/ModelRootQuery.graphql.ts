/**
 * @generated SignedSource<<4e4f67ae9ec7a3ad580f28ad465f28c8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelRootQuery$variables = Record<PropertyKey, never>;
export type ModelRootQuery$data = {
  readonly model: {
    readonly corpusInferences: {
      readonly endTime: string;
      readonly name: string;
      readonly startTime: string;
    } | null;
    readonly primaryInferences: {
      readonly endTime: string;
      readonly name: string;
      readonly startTime: string;
    };
    readonly referenceInferences: {
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
    "concreteType": "InferenceModel",
    "kind": "LinkedField",
    "name": "model",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Inferences",
        "kind": "LinkedField",
        "name": "primaryInferences",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Inferences",
        "kind": "LinkedField",
        "name": "referenceInferences",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Inferences",
        "kind": "LinkedField",
        "name": "corpusInferences",
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
    "cacheID": "c3baccc5527002697b40a06eef432a4d",
    "id": null,
    "metadata": {},
    "name": "ModelRootQuery",
    "operationKind": "query",
    "text": "query ModelRootQuery {\n  model {\n    primaryInferences {\n      name\n      startTime\n      endTime\n    }\n    referenceInferences {\n      name\n      startTime\n      endTime\n    }\n    corpusInferences {\n      name\n      startTime\n      endTime\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b73d8f3f532a0c6f88863f3c6dd5734f";

export default node;
