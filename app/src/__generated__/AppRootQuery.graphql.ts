/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * @generated SignedSource<<9c85aa6b1076be42ab12314c83978e59>>
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
    readonly name: string;
  };
  readonly referenceDataset: {
    readonly name: string;
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
    "cacheID": "a29bf65580844ece1a908f8ede2cf3a0",
    "id": null,
    "metadata": {},
    "name": "AppRootQuery",
    "operationKind": "query",
    "text": "query AppRootQuery {\n  primaryDataset {\n    name\n  }\n  referenceDataset {\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "f77baf0de9c7173d430a629e89533a72";

export default node;
