/**
 * @generated SignedSource<<3a57f8c746c865dda605f97e1ca36387>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type loadPlaygroundDatasetExampleCountQuery$variables = {
  id: string;
  splitIds: ReadonlyArray<string>;
};
export type loadPlaygroundDatasetExampleCountQuery$data = {
  readonly node: {
    readonly exampleCount?: number;
  };
};
export type loadPlaygroundDatasetExampleCountQuery = {
  response: loadPlaygroundDatasetExampleCountQuery$data;
  variables: loadPlaygroundDatasetExampleCountQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "splitIds"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "splitIds",
          "variableName": "splitIds"
        }
      ],
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "loadPlaygroundDatasetExampleCountQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "loadPlaygroundDatasetExampleCountQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "c492fb79e2cb26c8aefd6cae506133b6",
    "id": null,
    "metadata": {},
    "name": "loadPlaygroundDatasetExampleCountQuery",
    "operationKind": "query",
    "text": "query loadPlaygroundDatasetExampleCountQuery(\n  $id: ID!\n  $splitIds: [ID!]!\n) {\n  node(id: $id) {\n    __typename\n    ... on Dataset {\n      exampleCount(splitIds: $splitIds)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "33337e2099eee1fc003dc12f6d948015";

export default node;
