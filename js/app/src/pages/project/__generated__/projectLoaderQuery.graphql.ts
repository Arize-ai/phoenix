/**
 * @generated SignedSource<<275e9da8af028511b056afce687f3ea2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type projectLoaderQuery$variables = {
  id: string;
};
export type projectLoaderQuery$data = {
  readonly project: {
    readonly hasTraces?: boolean;
    readonly id: string;
    readonly name?: string;
  };
};
export type projectLoaderQuery = {
  response: projectLoaderQuery$data;
  variables: projectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
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
      "name": "hasTraces",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
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
    "name": "projectLoaderQuery",
    "selections": [
      {
        "alias": "project",
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
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "618164439b7b3848043f2a6452e204b8",
    "id": null,
    "metadata": {},
    "name": "projectLoaderQuery",
    "operationKind": "query",
    "text": "query projectLoaderQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    id\n    ... on Project {\n      name\n      hasTraces\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "24c436a8b54c67f1e3bf00d1e87ad535";

export default node;
